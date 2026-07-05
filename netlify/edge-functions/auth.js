export default async function auth(request, context) {
  const url = new URL(request.url);
  const cookie = request.headers.get("cookie") || "";

  // ✅ If cookie exists, allow access
  if (cookie.includes("auth=valid_session")) {
    return context.next();
  }

  // ✅ Handle POST (form submission)
  if (request.method === "POST") {
    const formData = await request.formData();
    const password = formData.get("password");

    if (password === "YourSecretPassword") {

      // ---- FIX: Redirect to GET instead of returning POST response ----
      return new Response(null, {
        status: 302,  // Redirect
        headers: {
          // Set the auth cookie
          "Set-Cookie": "auth=valid_session; Path=/; HttpOnly; Secure; Max-Age=86400",
          // Redirect user back to the page they were on (as GET request)
          "Location": url.pathname || "/",
        },
      });
      // ---- END FIX ----

    } else {
      // Wrong password
      return showLoginPage(true);
    }
  }

  // No cookie, show login page
  return showLoginPage(false);
}

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

        <script>
          // When login page loads, check sessionStorage
          // If NOT set, clear the server cookie
          if (!sessionStorage.getItem("tab_auth")) {
            document.cookie = 
              "auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT;";
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
