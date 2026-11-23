import { TaskBoard } from "@/components/tasks/task-board";
import { requireUser } from "@/lib/session";
import { getTasksBoard } from "@/server/queries-ops";

export const metadata = { title: "Tarefas" };

export default async function TasksPage() {
  const user = await requireUser();
  const board = await getTasksBoard(user.agencyId);
  return <TaskBoard tasks={board.tasks} members={board.members} clients={board.clients} me={user.id} />;
}
