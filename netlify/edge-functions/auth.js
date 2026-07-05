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
      
      // Get the actual page response from Netlify
      const response = await context.next();
      
      // Read the HTML body as text
      const originalBody = await response.text();

      // ---- INJECTION HAPPENS HERE ----
      // We ADD our script tag just before </body>
      const scriptToInject = `
        <script>
          // Set sessionStorage so this tab knows it's authenticated
          sessionStorage.setItem("tab_auth", "true");
        </script>
      `;

      const modifiedBody = originalBody.replace(
        "</body>",
        scriptToInject + "</body>"
      );
      // ---- END OF INJECTION ----

      // Build new headers with the cookie
      const headers = new Headers(response.headers);
      headers.set(
        "Set-Cookie",
        "auth=valid_session; Path=/; HttpOnly; Secure; Max-Age=86400"
      );

      // Return the MODIFIED response (with injected script)
      return new Response(modifiedBody, {
        status: response.status,
        headers,
      });

    } else {
      // Wrong password
      return showLoginPage(true);
    }
  }

  // ✅ Handle GET requests - check sessionStorage via cookie
  // If no cookie, show login page
  return showLoginPage(false);
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

        <script>
          // When login page loads, check if this tab has sessionStorage
          // If NOT, clear the server cookie so user must login
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
