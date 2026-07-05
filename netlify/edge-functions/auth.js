export default async function auth(request, context) {
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") || "";

  // ✅ Check for valid session cookie with timestamp
  if (cookie.includes("auth=valid_session")) {
    // Extract timestamp from cookie
    const match = cookie.match(/auth_time=(\d+)/);
    if (match) {
      const loginTime = parseInt(match[1]);
      const now = Date.now();
      const hoursPassed = (now - loginTime) / (1000 * 60 * 60);

      // ❌ If more than 24 hours passed, force re-login
      if (hoursPassed > 24) {
        return expireAndRedirect(url);
      }
    }
    // ✅ Within 24 hours, allow access
    return context.next();
  }

  // ✅ Handle POST (form submission)
  if (request.method === "POST") {
    const formData = await request.formData();
    const password = formData.get("password");

    if (password === "MyP4ss2026") {
      const loginTime = Date.now();

      return new Response(null, {
        status: 302,
        headers: {
          // SESSION cookie (no Max-Age = clears on browser close)
          // TWO cookies set together:
          // 1. auth cookie - session based (clears on browser close)
          // 2. auth_time cookie - stores login timestamp for 24hr check
          "Set-Cookie": [
            "auth=valid_session; Path=/; HttpOnly; Secure; SameSite=Strict",
            `auth_time=${loginTime}; Path=/; HttpOnly; Secure; SameSite=Strict`,
          ].join(", "),
          "Location": url.pathname || "/",
        },
      });

    } else {
      return showLoginPage(true);
    }
  }

  // No cookie, show login page
  return showLoginPage(false);
}

// -----------------------------------------------
// Helper: Expire cookies and redirect to login
// -----------------------------------------------
function expireAndRedirect(url) {
  return new Response(null, {
    status: 302,
    headers: {
      // Clear both cookies
      "Set-Cookie": [
        "auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;",
        "auth_time=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;",
      ].join(", "),
      "Location": url.pathname || "/",
    },
  });
}

// -----------------------------------------------
// Login Page HTML
// -----------------------------------------------
function showLoginPage(wrongPassword) {
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
            margin-top: 0.5rem;
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
