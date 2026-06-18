import { 
  useGetSystemStatus, 
  useGetSystemLogs,
  getGetSystemStatusQueryKey,
  getGetSystemLogsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Activity, Server, Database, Clock, ShieldAlert } from "lucide-react";

export default function SystemMonitor() {
  const { data: status, isLoading: loadingStatus } = useGetSystemStatus({
    query: { queryKey: getGetSystemStatusQueryKey(), refetchInterval: 5000 }
  });

  const { data: logs, isLoading: loadingLogs } = useGetSystemLogs(
    { limit: 20 },
    { query: { queryKey: getGetSystemLogsQueryKey({ limit: 20 }), refetchInterval: 10000 } }
  );

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Monitor</h1>
        <p className="text-sm text-muted-foreground">Infrastructure health and application logs</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Overall Health</h3>
            </div>
            <div className="mt-4">
              {loadingStatus ? <Skeleton className="h-8 w-20" /> : (
                <Badge variant="outline" className={status?.status === 'healthy' ? "border-success text-success text-lg py-1 px-3" : "border-warning text-warning text-lg py-1 px-3"}>
                  {status?.status.toUpperCase()}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Database</h3>
            </div>
            <div className="mt-4">
              {loadingStatus ? <Skeleton className="h-8 w-24" /> : (
                <div className={`text-lg font-mono font-medium ${status?.databaseConnected ? 'text-success' : 'text-destructive'}`}>
                  {status?.databaseConnected ? 'CONNECTED' : 'OFFLINE'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Uptime</h3>
            </div>
            <div className="mt-4">
              {loadingStatus ? <Skeleton className="h-8 w-32" /> : (
                <div className="text-lg font-mono">
                  {status?.uptime ? formatUptime(status.uptime) : '—'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Version</h3>
            </div>
            <div className="mt-4">
              {loadingStatus ? <Skeleton className="h-8 w-20" /> : (
                <div className="text-lg font-mono text-muted-foreground">
                  {status?.version || 'v0.0.0'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldAlert className="w-5 h-5 mr-2" />
            System Logs
          </CardTitle>
          <CardDescription>Recent application and service events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border bg-black/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-transparent">
                <TableRow className="border-border">
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[100px]">Level</TableHead>
                  <TableHead className="w-[150px]">Service</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLogs ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-border/50">
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : logs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No recent logs
                    </TableCell>
                  </TableRow>
                ) : (
                  logs?.map((log) => (
                    <TableRow key={log.id} className="border-border/50 hover:bg-transparent font-mono text-xs">
                      <TableCell className="text-muted-foreground">{formatDate(log.timestamp)}</TableCell>
                      <TableCell>
                        <span className={
                          log.level === 'error' ? 'text-destructive font-bold' :
                          log.level === 'warn' ? 'text-warning font-bold' :
                          log.level === 'info' ? 'text-blue-400' : 'text-muted-foreground'
                        }>
                          [{log.level?.toUpperCase()}]
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{log.service}</TableCell>
                      <TableCell className="text-foreground">{log.message}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
