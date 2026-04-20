import { TokenJS } from 'token.js';
import * as bridge from '../bridge-client';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { runs, workers, messages as dbMessages, settings, plans, planItems, clarifications } from '../db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { CreditManager } from '../credits';
import { parsePlan } from '../plans/parser';
import { syncPlanItems } from '../plans/checklist';
import { assessPlanReadiness } from '../plans/readiness';
import { pauseForClarifications } from '../clarifications/loop';
import { SUPERVISOR_SYSTEM_PROMPT } from './prompt';
import { buildSupervisorTools } from './tools';
import { nextRunState } from './runtime';
import { createExecutionGraph } from '../workers/orchestrator';
import { validateRun } from '../validation';
import { classifyPermissionRequest } from '../permissions';

const tokenjs = new TokenJS();

export interface SupervisorOptions {
  planId: string;
  runId: string;
}

export class Supervisor {
  private runId: string;
  private planId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private messages: any[] = [];
  
  constructor(options: SupervisorOptions) {
    this.runId = options.runId;
    this.planId = options.planId;
  }

  async run() {
    const allSettings = await db.select().from(settings);
    const envParams: Record<string, string> = {};
    allSettings.forEach(s => {
      envParams[s.key] = s.value;
      process.env[s.key] = s.value;
    });

    const planRecord = await db.select().from(plans).where(eq(plans.id, this.planId)).get();
    if (!planRecord) {
      throw new Error(`Plan ${this.planId} not found`);
    }

    const planContent = fs.readFileSync(path.resolve(process.cwd(), planRecord.path), 'utf-8');
    const parsedPlan = parsePlan(planContent);
    await syncPlanItems(this.planId, parsedPlan.items);
    const readiness = await assessPlanReadiness(parsedPlan);

    if (!readiness.ready) {
      await pauseForClarifications(this.runId, readiness.questions);
      this.messages.push({
        role: 'system',
        content: `Plan is awaiting clarification. Questions asked: ${readiness.questions.join(' | ')}`,
      });
      while (true) {
        const pendingClarifications = await db.select().from(clarifications).where(eq(clarifications.runId, this.runId));
        const unresolved = pendingClarifications.filter(c => c.status === 'pending');
        if (unresolved.length === 0) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (parsedPlan.items.length > 1 && process.env.MOCK_LLM !== 'true') {
      const taskGraph = await createExecutionGraph(`plan-${this.planId}`, parsedPlan.items);
      await db.insert(dbMessages).values({
        id: randomUUID(),
        runId: this.runId,
        role: 'system',
        content: `Created execution graph ${taskGraph.id} for ${parsedPlan.items.length} plan items.`,
        createdAt: new Date(),
      });
    }

    await db.update(runs).set({ status: 'executing', updatedAt: new Date() }).where(eq(runs.id, this.runId));

    this.messages.push({
      role: 'system',
      content: SUPERVISOR_SYSTEM_PROMPT,
    });

    let mockStep = 0;

    while (true) {
      let message;

      if (process.env.MOCK_LLM === 'true') {
        const mockResponses = [
          {
            tool_calls: [{ id: 'tc1', function: { name: 'plan_read', arguments: JSON.stringify({ path: this.planId ? 'vibes/test-plan.md' : '' }) } }]
          },
          {
            tool_calls: [{ id: 'tc2', function: { name: 'worker_spawn', arguments: JSON.stringify({ type: 'codex', cwd: process.cwd(), mode: 'auto' }) } }]
          },
          {
            tool_calls: [
              { id: 'tc3', function: { name: 'worker_send_prompt', arguments: JSON.stringify({ id: 'mock-id', prompt: 'Create hello.txt with content "Hello World"' }) } }
            ]
          },
          {
            tool_calls: [
               { id: 'tc4', function: { name: 'plan_checklist_update', arguments: JSON.stringify({ item: 'Create hello.txt', status: 'done' }) } },
               { id: 'tc5', function: { name: 'worker_send_prompt', arguments: JSON.stringify({ id: 'mock-id', prompt: 'Create hi.txt with content "Hi World"' }) } }
            ]
          },
          {
            tool_calls: [
               { id: 'tc6', function: { name: 'plan_checklist_update', arguments: JSON.stringify({ item: 'Create hi.txt', status: 'done' }) } },
               { id: 'tc7', function: { name: 'worker_send_prompt', arguments: JSON.stringify({ id: 'mock-id', prompt: 'Create greetings.txt with content "Greetings"' }) } }
            ]
          },
          {
            tool_calls: [
               { id: 'tc8', function: { name: 'plan_checklist_update', arguments: JSON.stringify({ item: 'Create greetings.txt', status: 'done' }) } },
               { id: 'tc9', function: { name: 'plan_mark_done', arguments: JSON.stringify({ reason: 'All checklist items completed' }) } }
            ]
          }
        ];
        message = mockResponses[mockStep++] || { content: "Done" };
        
        // In mock mode, we need to pass the real worker ID instead of 'mock-id'
        if (message.tool_calls) {
          message.tool_calls.forEach(tc => {
             if (tc.function.name === 'worker_send_prompt') {
                const args = JSON.parse(tc.function.arguments);
                const worker = this.messages.find(m => m.content && m.content.includes('Spawned worker ID:'));
                if (worker) {
                   const match = worker.content.match(/Spawned worker ID: (worker-\d+)/);
                   if (match) args.id = match[1];
                }
                tc.function.arguments = JSON.stringify(args);
             }
          });
        }
      } else {
        const completion = await tokenjs.chat.completions.create({
          provider: 'openai', // We can use openai or anthropic with TokenJS
          model: 'gpt-4o',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages: this.messages as any,
          tools: buildSupervisorTools(),
      });
      message = completion.choices[0].message;
      }

      this.messages.push(message);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((message as any).content) {
        await db.insert(dbMessages).values({
          id: randomUUID(),
          runId: this.runId,
          role: 'supervisor',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: (message as any).content,
          createdAt: new Date(),
        });
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          let result: string;
          
          let logContent = `Action: ${toolCall.function.name}`;
          if (args.prompt) logContent += `\nPrompt: ${args.prompt}`;
          if (args.path) logContent += `\nPath: ${args.path}`;
          
          await db.insert(dbMessages).values({
            id: randomUUID(),
            runId: this.runId,
            role: 'system',
            content: logContent,
            createdAt: new Date(),
          });
          
          if (toolCall.function.name === 'plan_read') {
            try {
              const content = fs.readFileSync(path.resolve(process.cwd(), args.path), 'utf-8');
              const parsed = parsePlan(content);
              await syncPlanItems(this.planId, parsed.items);
              result = content;
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              result = `Error reading plan: ${errorMessage}`;
            }
          } else if (toolCall.function.name === 'worker_spawn') {
            try {
              const workerId = `worker-${Date.now()}`;
              if (process.env.MOCK_LLM !== 'true') {
                await bridge.spawnAgent({
                  type: args.type,
                  cwd: args.cwd,
                  name: workerId,
                  mode: args.mode,
                  env: envParams
                });
              }
              
              await db.insert(workers).values({
                id: workerId,
                runId: this.runId,
                type: args.type,
                status: 'idle',
                cwd: args.cwd,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              
              result = `Spawned worker ID: ${workerId}`;
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              result = `Error spawning worker: ${errorMessage}`;
            }
          } else if (toolCall.function.name === 'worker_send_prompt') {
             try {
               let res;
               if (process.env.MOCK_LLM === 'true') {
                  res = { response: 'Action completed (mock)', state: 'idle' };
                  if (args.prompt.includes('hello.txt')) fs.writeFileSync('hello.txt', 'Hello World');
                  if (args.prompt.includes('hi.txt')) fs.writeFileSync('hi.txt', 'Hi World');
                  if (args.prompt.includes('greetings.txt')) fs.writeFileSync('greetings.txt', 'Greetings');
               } else {
                  res = await bridge.askAgent(args.id, args.prompt);
               }
               result = `Response: ${res.response}\nState: ${res.state}`;
             } catch (err: unknown) {              const errorMessage = err instanceof Error ? err.message : String(err);
              result = `Error sending prompt: ${errorMessage}`;
            }
          } else if (toolCall.function.name === 'worker_read_output') {
             try {
               const agentData = await bridge.getAgent(args.id);
               result = `Current Output:\n${agentData.currentText}\n\nLast Output:\n${agentData.lastText}`;
               const decision = classifyPermissionRequest(`${agentData.currentText}\n${agentData.lastText}\n${agentData.stderrBuffer.join("\n")}`);
               if (decision === 'approve') {
                 await bridge.approvePermission(args.id);
                 result += `\nPermission decision: auto-approved`;
               } else if (decision === 'escalate') {
                 await db.insert(dbMessages).values({
                   id: randomUUID(),
                   runId: this.runId,
                   role: 'supervisor',
                   content: `Permission escalation required for worker ${args.id}.`,
                   createdAt: new Date(),
                 });
                 await db.update(runs).set({ status: 'awaiting_user', updatedAt: new Date() }).where(eq(runs.id, this.runId));
                 result += `\nPermission decision: escalate to user`;
               }
             } catch (err: unknown) {
               const errorMessage = err instanceof Error ? err.message : String(err);
               result = `Error reading output: ${errorMessage}`;
             }
          } else if (toolCall.function.name === 'plan_checklist_update') {
            try {
              const items = await db.select().from(planItems).where(eq(planItems.planId, this.planId));
              const itemToken = (args.item.match(/`([^`]+)`/)?.[1] ?? args.item.match(/([A-Za-z0-9_.-]+\.[A-Za-z0-9]+)$/)?.[1] ?? args.item).toLowerCase();
              const item = items.find(entry => entry.title.toLowerCase().includes(itemToken)) || items[0];
              if (item) {
                await db.update(planItems).set({
                  status: args.status,
                  updatedAt: new Date(),
                }).where(eq(planItems.id, item.id));
              }
              result = `Checklist updated: ${args.item} -> ${args.status}`;
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              result = `Error updating checklist: ${errorMessage}`;
            }
          } else if (toolCall.function.name === 'worker_approve') {
             try {
               await bridge.approvePermission(args.id);
               result = `Worker ${args.id} permission approved.`;
             } catch (err: unknown) {
               const errorMessage = err instanceof Error ? err.message : String(err);
               result = `Error approving worker permission: ${errorMessage}`;
             }
          } else if (toolCall.function.name === 'worker_deny') {
             try {
               await bridge.denyPermission(args.id);
               result = `Worker ${args.id} permission denied.`;
             } catch (err: unknown) {
               const errorMessage = err instanceof Error ? err.message : String(err);
               result = `Error denying worker permission: ${errorMessage}`;
             }
          } else if (toolCall.function.name === 'worker_set_mode') {
             try {
               await bridge.setWorkerMode(args.id, args.mode);
               result = `Worker ${args.id} mode set to ${args.mode}.`;
             } catch (err: unknown) {
               const errorMessage = err instanceof Error ? err.message : String(err);
               result = `Error setting worker mode: ${errorMessage}`;
             }
          } else if (toolCall.function.name === 'worker_cancel') {
             try {
               await bridge.cancelAgent(args.id);
               result = `Worker ${args.id} cancelled.`;
             } catch (err: unknown) {
               const errorMessage = err instanceof Error ? err.message : String(err);
               result = `Error cancelling worker: ${errorMessage}`;
             }
          } else if (toolCall.function.name === 'credits_check') {
             try {
               const creditManager = new CreditManager();
               result = await creditManager.checkCredits(args.accountId);
             } catch (err: unknown) {
               const errorMessage = err instanceof Error ? err.message : String(err);
               result = `Error checking credits: ${errorMessage}`;
             }
          } else if (toolCall.function.name === 'credits_switch') {
             try {
               const creditManager = new CreditManager();
               result = await creditManager.applyStrategy(args.workerId, args.strategy);
             } catch (err: unknown) {
               const errorMessage = err instanceof Error ? err.message : String(err);
               result = `Error switching credits: ${errorMessage}`;
             }
          } else if (toolCall.function.name === 'plan_mark_done') {
            const validation = await validateRun(this.runId);
            const pendingItems = await db.select().from(planItems).where(eq(planItems.planId, this.planId));
            const pendingCount = pendingItems.filter(item => item.status !== 'done').length;
            const snapshot = {
              status: 'validating',
              pendingClarifications: 0,
              unvalidatedDoneItems: validation.ok ? 0 : 1,
              pendingItems: pendingCount,
            };
            const nextState = nextRunState(snapshot);
            if (!validation.ok || nextState !== 'completed') {
              await db.update(runs).set({ status: 'executing', updatedAt: new Date() }).where(eq(runs.id, this.runId));
              result = `Validation blocked completion: ${validation.failures.join('; ')}`;
            } else {
              await db.update(runs).set({ status: 'done', updatedAt: new Date() }).where(eq(runs.id, this.runId));
              result = 'Plan marked as done. Supervisor loop will terminate.';
              await db.insert(dbMessages).values({
                id: randomUUID(),
                runId: this.runId,
                role: 'worker',
                content: result,
                createdAt: new Date(),
              });
              this.messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result
              });
              return; // Terminate loop
            }
          } else if (toolCall.function.name === 'user_ask') {
            await db.insert(dbMessages).values({
              id: randomUUID(),
              runId: this.runId,
              role: 'supervisor',
              content: args.question,
              createdAt: new Date(),
            });
            await db.insert(clarifications).values({
              id: randomUUID(),
              runId: this.runId,
              question: args.question,
              answer: null,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            await db.update(runs).set({ status: 'awaiting_user', updatedAt: new Date() }).where(eq(runs.id, this.runId));
            result = 'User asked (simulated).';
          } else {
            result = `Unknown tool: ${toolCall.function.name}`;
          }

          if (result) {
            await db.insert(dbMessages).values({
              id: randomUUID(),
              runId: this.runId,
              role: 'worker', // Rendered distinctly
              content: result.substring(0, 4000), // Avoid crazy big blobs in chat
              createdAt: new Date(),
            });
          }

          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result
          });
        }
      } else {
        // If no tool calls, just break or loop (ideally should have plan_mark_done)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log("No tool calls, output:", (message as any).content);
        break;
      }
    }
  }
}
