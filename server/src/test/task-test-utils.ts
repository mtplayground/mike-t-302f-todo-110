import { prisma } from "../db/prisma.js";

export const serviceTestPrefix = "test-service-task-";
export const routeTestPrefix = "test-route-task-";

export async function cleanupTasks(prefix: string): Promise<void> {
  await prisma.task.deleteMany({
    where: {
      title: {
        startsWith: prefix,
      },
    },
  });
}
