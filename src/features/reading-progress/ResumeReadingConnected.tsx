import { getReadingProgress } from "./queries";
import { ResumeReading } from "./ResumeReading";

type Props = { postId: string; userId: string };

// Server part: reads the saved place, then hands it to the browser part.
export async function ResumeReadingConnected({ postId, userId }: Props) {
  const initialProgress = await getReadingProgress(postId, userId);
  return <ResumeReading postId={postId} initialProgress={initialProgress} />;
}