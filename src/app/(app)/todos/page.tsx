import { redirect } from "next/navigation";
import { TodosDashboard } from "@/components/todos-dashboard";
import { getAppContext, getCurrentTodos } from "@/lib/server-data";
import { localDateKey } from "@/lib/planner";
import { isDateKey } from "@/lib/todos";

export const metadata = { title: "Todos" };

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { user, profile } = await getAppContext();
  if (!user) return null;
  if (!profile) redirect("/onboarding");
  const todayKey = localDateKey(new Date(), profile.timezone);
  const requested = (await searchParams).date;
  const selectedDate = requested && isDateKey(requested) ? requested : todayKey;
  const todos = await getCurrentTodos();
  return <TodosDashboard userId={user.id} todayKey={todayKey} selectedDate={selectedDate} initialTodos={todos} />;
}
