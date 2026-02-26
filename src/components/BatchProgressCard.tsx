import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface BatchProgressProps {
  id: string;
  name: string;
  total: number;
  processed: number;
  failed: number;
  status: "processing" | "completed" | "partially_completed";
}

const statusStyles: Record<string, string> = {
  processing: "bg-info/10 text-info border-info/20",
  completed: "bg-success/10 text-success border-success/20",
  partially_completed: "bg-warning/10 text-warning border-warning/20",
};

const BatchProgressCard = ({ id, name, total, processed, failed, status }: BatchProgressProps) => {
  const percent = Math.round((processed / total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-card-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">Batch #{id}</p>
        </div>
        <Badge variant="outline" className={statusStyles[status]}>
          {status === "processing" ? "Processing" : status === "completed" ? "Completed" : "Partial"}
        </Badge>
      </div>
      <Progress value={percent} className="h-2 mb-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{processed.toLocaleString()} / {total.toLocaleString()} processed</span>
        {failed > 0 && <span className="text-destructive">{failed} failed</span>}
        <span className="font-medium">{percent}%</span>
      </div>
    </motion.div>
  );
};

export default BatchProgressCard;
