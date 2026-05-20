import { OmniApp } from "@/ui/OmniApp";
import { buildHomeBootstrap } from "./home/bootstrap.server";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const bootstrap = await buildHomeBootstrap(await searchParams);
  return <OmniApp bootstrap={bootstrap} />;
}
