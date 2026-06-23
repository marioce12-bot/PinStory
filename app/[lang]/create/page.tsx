import { notFound } from "next/navigation";
import { Configurator } from "@/components/configurator/Configurator";
import { getDictionary, isLocale } from "@/lib/i18n";
import { isPlan, type Plan } from "@/lib/plans";

export default async function CreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { lang } = await params;
  const { plan } = await searchParams;
  if (!isLocale(lang)) notFound();

  const initialPlan: Plan = plan && isPlan(plan) ? plan : "souvenir";

  return <Configurator lang={lang} dictionary={getDictionary(lang)} initialPlan={initialPlan} />;
}
