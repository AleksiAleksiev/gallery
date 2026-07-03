import timeline from "../../data/json/timeline.json";
import TimelineApp from "@/components/timeline/TimelineApp";
import type { TimelineData } from "@/lib/timeline";

export default function Home() {
  return <TimelineApp data={timeline as TimelineData} />;
}
