import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecret } from "@/lib/secrets";

const SESSION_COOKIE = "session";

function isPublicAdminPath(pathname: string) {
  return pathname === "/admin/login" || pathname === "/api/admin/login";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const repeatedCgSlug = pathname.match(
    /^\/estoque\/honda-cg-160-start-160-start-(\d{4}-c[a-z0-9]{20,32})$/i,
  );
  if (repeatedCgSlug) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/estoque/honda-cg-160-start-${repeatedCgSlug[1]}`;
    return NextResponse.redirect(destination, 301);
  }

  if (
    pathname !== "/admin" &&
    !pathname.startsWith("/admin/") &&
    !pathname.startsWith("/api/admin/")
  ) {
    return NextResponse.next();
  }

  if (isPublicAdminPath(pathname)) {
    return NextResponse.next();
  }

  const isAdminApi = pathname.startsWith("/api/admin");
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    await jwtVerify(token, await getJwtSecret());
    return NextResponse.next();
  } catch {
    if (isAdminApi) {
      const response = NextResponse.json(
        { error: "Não autorizado." },
        { status: 401 },
      );
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        path: "/",
        maxAge: 0,
      });
      return response;
    }

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
  matcher: ["/admin/:path*", "/api/admin/:path*", "/estoque/:path*"],
};
