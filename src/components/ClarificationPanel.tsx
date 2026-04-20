"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Clarification {
  id: string;
  question: string;
  answer: string | null;
  status: string;
}

interface ClarificationPanelProps {
  clarifications: Clarification[];
  onAnswer: (clarificationId: string, answer: string) => Promise<void> | void;
}

export function ClarificationPanel({ clarifications, onAnswer }: ClarificationPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const pending = clarifications.filter((item) => item.status === "pending");

  return (
    <Card className="border-border/60 bg-background/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Clarifications</span>
          <Badge variant="secondary">{pending.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {clarifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outstanding questions.</p>
        ) : (
          clarifications.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm leading-5">{item.question}</p>
                <Badge variant={item.status === "answered" ? "default" : "secondary"}>{item.status}</Badge>
              </div>
              {item.status === "pending" ? (
                <div className="flex gap-2">
                  <Input
                    value={answers[item.id] || ""}
                    onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
                    placeholder="Answer this question"
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    onClick={() => onAnswer(item.id, answers[item.id] || "")}
                    disabled={!answers[item.id]}
                  >
                    Send
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{item.answer || "Answered"}</p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
