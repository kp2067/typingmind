export default async function auth(request, context) {
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") || "";
  const pathname = url.pathname;

  // ✅ Logout route - clears cookie and redirects to login
  if (pathname === "/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        "Set-Cookie": "auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure",
        "Location": "/",
      },
    });
  }

  // ✅ Session bridge page - sets sessionStorage then redirects
  if (pathname === "/session-bridge") {
    const redirectTo = url.searchParams.get("redirect") || "/";
    return new Response(sessionBridgePage(redirectTo), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  // ✅ Session check route - called by beacon on tab close
  if (pathname === "/session-check") {
    return new Response("ok", { status: 200 });
  }

  // ✅ Cookie exists, allow access
  if (cookie.includes("auth=valid_session")) {
    return context.next();
  }

  // ✅ Handle POST login
  if (request.method === "POST") {
    const formData = await request.formData();
    const password = formData.get("password");

    if (password === "YourSecretPassword") {
      return new Response(null, {
        status: 302,
        headers: {
          "Set-Cookie": "auth=valid_session; Path=/; HttpOnly; Secure; Max-Age=86400",
          "Location": "/session-bridge?redirect=" + (pathname || "/"),
        },
      });
    } else {
      return showLoginPage(true, pathname);
    }
  }

  return showLoginPage(false, pathname);
}

function sessionBridgePage(redirectTo) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Loading...</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f0f0f0;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #ddd;
            border-top: 4px solid #00ad9f;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 1rem auto;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          p { color: #555; text-align: center; }
        </style>
      </head>
      <body>
        <div>
          <div class="spinner"></div>
          <p>Loading, please wait...</p>
        </div>

        <script>
          // ✅ Mark this tab as authenticated
          sessionStorage.setItem("tab_auth", "true");

          // ✅ When this tab closes, call /logout to clear cookie
          window.addEventListener("beforeunload", function() {
            navigator.sendBeacon("/logout");
          });

          // ✅ Go to actual site
          window.location.href = "${redirectTo}";
        </script>
      </body>
    </html>
  `;
}

function showLoginPage(wrongPassword, pathname) {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Login</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f0f0f0;
          }
          .login-box {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            width: 300px;
          }
          h2 { margin-top: 0; color: #333; }
          input {
            display: block;
            margin: 1rem 0;
            padding: 0.5rem;
            width: 100%;
            font-size: 1rem;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          button {
            background: #00ad9f;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            font-size: 1rem;
            cursor: pointer;
            width: 100%;
            border-radius: 4px;
          }
          button:hover { background: #008f83; }
          .error {
            color: red;
            font-size: 0.9rem;
          }
        </style>
      </head>
      <body>
        <div class="login-box">
          <h2>Please Login</h2>
          ${wrongPassword ? '<p class="error">❌ Wrong password, try again.</p>' : ""}
          <form method="POST">
            <input
              type="password"
              name="password"
              placeholder="Enter Password"
              required
              autofocus
            />
            <button type="submit">Login</button>
          </form>
        </div>

        <script>
          if (!sessionStorage.getItem("tab_auth")) {
            document.cookie = 
              "auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure";
          }
        </script>
      </body>
    </html>
    `,
    {
      status: 401,
      headers: { "Content-Type": "text/html" },
    }
  );
}

export const config = {
  path: "/*",
};
