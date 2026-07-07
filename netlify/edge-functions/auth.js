// -----------------------------------------------
// Environment Variables (set in Netlify Dashboard)
// NETLIFY ENV VARS NEEDED:
//   APP_PASSWORD = your login password
//   SECRET_KEY   = a long random string for signing
// -----------------------------------------------
const PASSWORD = Netlify.env.get("APP_PASSWORD");
const SECRET_KEY = Netlify.env.get("SECRET_KEY");

// -----------------------------------------------
// Generate a random hex token (32 bytes = 64 chars)
// -----------------------------------------------
function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// -----------------------------------------------
// Create a signed token: "randomToken.HMACsignature"
// -----------------------------------------------
async function createSignedToken() {
  const token = generateToken();
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token)
  );

  const sigHex = Array.from(
    new Uint8Array(signature),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");

  // Final token format: "randompart.signaturepart"
  return `${token}.${sigHex}`;
}

// -----------------------------------------------
// Verify a signed token - returns true/false
// -----------------------------------------------
async function verifySignedToken(cookieValue) {
  try {
    const [token, signature] = cookieValue.split(".");

    // If either part is missing, reject
    if (!token || !signature) return false;

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SECRET_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = new Uint8Array(
      signature.match(/.{2}/g).map((b) => parseInt(b, 16))
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(token)
    );

    return isValid;
  } catch {
    // Any error (malformed token, etc.) = invalid
    return false;
  }
}

// -----------------------------------------------
// Extract a specific cookie value by name
// -----------------------------------------------
function getCookieValue(cookieHeader, name) {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

// -----------------------------------------------
// Main Edge Function
// -----------------------------------------------
export default async function auth(request, context) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") || "";

  // ✅ Step 1: Check for existing auth cookie
  const existingToken = getCookieValue(cookieHeader, "auth");

  if (existingToken) {
    const isValid = await verifySignedToken(existingToken);

    if (isValid) {
      // ✅ Token is genuine, now check 24hr expiry
      const authTime = getCookieValue(cookieHeader, "auth_time");

      if (authTime) {
        const loginTime = parseInt(authTime);
        const now = Date.now();
        const hoursPassed = (now - loginTime) / (1000 * 60 * 60);

        // ❌ More than 24 hours passed, force re-login
        if (hoursPassed > 24) {
          return expireAndRedirect(url);
        }
      }

      // ✅ Valid token + within 24hrs, allow access
      return context.next();
    } else {
      // ❌ Token failed verification (forged/tampered)
      // Clear bad cookies and show login
      return expireAndRedirect(url);
    }
  }

  // ✅ Step 2: Handle POST (form submission)
  if (request.method === "POST") {
    const formData = await request.formData();
    const password = formData.get("password");

    if (password === PASSWORD) {
      // ✅ Correct password - generate signed token
      const signedToken = await createSignedToken();
      const loginTime = Date.now();

      return new Response(null, {
        status: 302,
        headers: {
          // TWO cookies:
          // 1. auth = signed token (replaces plain "valid_session")
          // 2. auth_time = login timestamp for 24hr check
          "Set-Cookie": [
            `auth=${signedToken}; Path=/; HttpOnly; Secure; SameSite=Strict`,
            `auth_time=${loginTime}; Path=/; HttpOnly; Secure; SameSite=Strict`,
          ].join(", "),
          Location: url.pathname || "/",
        },
      });
    } else {
      // ❌ Wrong password
      return showLoginPage(true);
    }
  }

  // No cookie, no POST - show login page
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
      Location: "/",
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
