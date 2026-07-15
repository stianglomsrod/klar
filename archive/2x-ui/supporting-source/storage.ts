import { createClient } from "@/utils/supabase/client";

const BUCKET = "student-media";

/**
 * Upload a file to Supabase Storage and return the public URL.
 * Path format: {studentId}/{taskId}/{type}_{timestamp}.{ext}
 */
export async function uploadStudentMedia(
  file: Blob,
  studentId: string,
  taskId: string,
  type: "image" | "audio",
): Promise<string> {
  const supabase = createClient();

  const ext =
    type === "image" ? "jpg" : file.type.includes("webm") ? "webm" : "mp4";
  const fileName = `${studentId}/${taskId}/${type}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: type === "image" ? "image/jpeg" : file.type,
  });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

  return publicUrl;
}
