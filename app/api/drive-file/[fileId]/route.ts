import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/drive-file/[fileId]
 * Streams a Google Drive file to the browser using the teacher's stored OAuth token.
 * This keeps the access token server-side and never exposes it to the client.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const supabase = await createClient();

  // 1. Verify the user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Get the teacher's refresh token
  const { data: tokenRow } = await supabase
    .from("user_provider_tokens")
    .select("provider_refresh_token")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return NextResponse.json({ error: "No Google token — please re-authenticate" }, { status: 403 });
  }

  // 3. Exchange refresh token for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: tokenRow.provider_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Failed to refresh Google token" }, { status: 502 });
  }

  const { access_token } = await tokenRes.json();

  // 4. Get file metadata for MIME type
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  if (!metaRes.ok) {
    return NextResponse.json({ error: `Drive metadata failed: ${metaRes.status}` }, { status: 502 });
  }

  const meta = await metaRes.json();
  let mimeType: string = meta.mimeType ?? "image/jpeg";
  let downloadUrl: string;

  if (mimeType.startsWith("application/vnd.google-apps")) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
    mimeType = "application/pdf";
  } else {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  // 5. Stream the file back to the browser
  const fileRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!fileRes.ok) {
    return NextResponse.json({ error: `Drive download failed: ${fileRes.status}` }, { status: 502 });
  }

  return new NextResponse(fileRes.body, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "no-store",
    },
  });
}
