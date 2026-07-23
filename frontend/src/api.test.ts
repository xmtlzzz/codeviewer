import {
  buildGithubReposUrl,
  getGithubPublicRepos,
  mapGithubPublicRepos,
  type GithubApiRepo,
} from "./api.ts";

function repo(name: string, extra: Partial<GithubApiRepo> = {}): GithubApiRepo {
  return {
    name,
    full_name: `octocat/${name}`,
    html_url: `https://github.com/octocat/${name}`,
    description: null,
    language: "TypeScript",
    stargazers_count: 1,
    forks_count: 2,
    private: false,
    updated_at: "2026-07-23T10:20:30Z",
    ...extra,
  };
}

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const url = new URL(buildGithubReposUrl("octo cat", 2));
expect(url.pathname === "/users/octo%20cat/repos", "username should be encoded");
expect(url.searchParams.get("type") === "owner", "type should be owner");
expect(url.searchParams.get("sort") === "updated", "sort should be updated");
expect(url.searchParams.get("per_page") === "100", "per_page should be 100");
expect(url.searchParams.get("page") === "2", "page should be included");

const mapped = mapGithubPublicRepos([
  repo("public-repo"),
  repo("private-repo", { private: true }),
]);
expect(mapped.length === 1, "private repos should be filtered");
expect(mapped[0].name === "public-repo", "public repo should be preserved");
expect(mapped[0].stars === 1, "stars should be mapped");
expect(mapped[0].forks === 2, "forks should be mapped");
expect(mapped[0].last_date === "2026-07-23", "updated_at should map to date");

const calls: Array<{ url: string; authorization?: string }> = [];
const pages = [
  Array.from({ length: 100 }, (_, index) => repo(`page-one-${index}`)),
  [repo("page-two-public"), repo("page-two-private", { private: true })],
];

const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = init?.headers as Record<string, string> | undefined;
  calls.push({
    url: String(input),
    authorization: headers?.Authorization,
  });
  const body = pages[calls.length - 1];
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
};

const repos = await getGithubPublicRepos(
  "octocat",
  "  ghp_token  ",
  fetchImpl as typeof fetch,
);

expect(calls.length === 2, "pagination should continue after a full page");
expect(calls[0].url.includes("page=1"), "first page should be requested");
expect(calls[1].url.includes("page=2"), "second page should be requested");
expect(
  calls.every((call) => call.authorization === "Bearer ghp_token"),
  "token should be trimmed and sent",
);
expect(repos.length === 101, "private repos should be filtered after pagination");
