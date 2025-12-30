import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { rateLimit, getClientIp } from "../../lib/rate-limit";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function isValidGitHubUsername(username: string): boolean {
  return (
    typeof username === "string" &&
    username.length >= 1 &&
    username.length <= 39 &&
    GITHUB_USERNAME_REGEX.test(username) &&
    !username.includes("--")
  );
}

function createSecureResponse(
  data: unknown,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

async function queryGitHub(query: string, variables: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Analytics-Dashboard",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with status ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  if (!GITHUB_TOKEN) {
    return createSecureResponse(
      { error: "Server configuration error" },
      500
    );
  }

  const ip = getClientIp(request);
  const { success, remaining } = rateLimit(ip);

  if (!success) {
    const response = createSecureResponse(
      { error: "Too many requests. Please try again later." },
      429
    );
    response.headers.set("Retry-After", "60");
    return response;
  }

  const { username } = await params;

  if (!isValidGitHubUsername(username)) {
    return createSecureResponse(
      { error: "Invalid username format" },
      400
    );
  }

  const query = `
    query PinnedRepos($username: String!) {
      user(login: $username) {
        pinnedItems(first: 6, types: [REPOSITORY]) {
          totalCount
          edges {
            node {
              ... on Repository {
                name
                id
                url
                description
                stargazers {
                  totalCount
                }
                forkCount
                primaryLanguage {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;

  const getCachedPinnedRepos = unstable_cache(
    async () => queryGitHub(query, { username }),
    [`pinned-repos-${username}`],
    { revalidate: 300 }
  );

  try {
    const data = await getCachedPinnedRepos();

    if (data.errors) {
      console.error("GitHub API errors:", JSON.stringify(data.errors));
      const isNotFound = data.errors.some(
        (e: { type?: string }) => e.type === "NOT_FOUND"
      );
      return createSecureResponse(
        { error: isNotFound ? "User not found" : "Failed to fetch pinned repos" },
        isNotFound ? 404 : 400
      );
    }

    const response = createSecureResponse(data.data);
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    return response;
  } catch (error) {
    console.error("GitHub API request failed:", error);
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return createSecureResponse(
      { error: isTimeout ? "Request timeout" : "Failed to fetch pinned repos" },
      isTimeout ? 504 : 500
    );
  }
}
