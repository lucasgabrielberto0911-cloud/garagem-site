import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/secrets";

const SESSION_COOKIE = "session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    await jwtVerify(token, await getJwtSecret());
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(
      new URL("/admin/login", request.url),
    );
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
