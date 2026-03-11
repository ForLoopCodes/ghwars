// Admin activity logs page
// Shows all admin actions with timestamps

import { db } from "@/db";
import { adminLogs, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AdminLogs() {
  const logs = await db.select({
    id: adminLogs.id,
    action: adminLogs.action,
    details: adminLogs.details,
    createdAt: adminLogs.createdAt,
    adminUsername: users.username,
  })
    .from(adminLogs)
    .innerJoin(users, eq(adminLogs.adminId, users.id))
    .orderBy(desc(adminLogs.createdAt))
    .limit(200);

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium">Admin Logs ({logs.length})</CardTitle></CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No admin actions recorded</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Admin</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{log.createdAt.toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{log.adminUsername}</TableCell>
                  <TableCell className="text-sm font-medium">{log.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
