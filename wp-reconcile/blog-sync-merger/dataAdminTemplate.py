#!/usr/bin/env python3
"""Blog-Sync-Merger data-admin template.

Goal: walk a range of WN issues, look at every article's markdown across
every language, and patch the ones that need an automated fix - the shape
most bulk content-cleanup jobs need (e.g. "find and fix a markdown pattern
Hugo chokes on but osmbc itself tolerates", across the whole archive).

    for each WN blog in [--min-blog-number .. --max-blog-number]:
        GET  /api/blogSync/<key>/<blog>              (one call per blog -
             already returns every article with EVERY language's
             markdown<LANG> field, no per-language call needed)
            for each article:
                for each markdown<LANG> field:
                    inspect it, decide the fixed text (compute_patches)
        POST /api/blogSync/<key>/<blog>/apply         (only if anything
             needed a patch for this blog)

Every write is attributed to whatever value your own API key is configured
with (its `apiKeys` label doubles as your name, see docs/API.md) - that's
your "signature" in the changes-log audit trail, automatic, nothing this
script has to add itself.

The included compute_patches() is a real, runnable example (an osmbc-
tolerated-but-Hugo-rejected markdown pattern: a link target accidentally
wrapped in doubled parens, `](( url ))` instead of `](url)`) - copy its
shape for whatever pattern your own job needs to find/fix.

Setup: ask whoever manages the target OSMBC instance's config for a
dedicated API key, added to that instance's `apiKeys` config with a
NAME-SHAPED value of your choosing rather than a free-text description -
that value becomes both your login and your name in the changes-log audit
trail:
  apiKeys:
    <your-key>: dataAdmin-<you>

Usage:
  pip install requests   # the only non-stdlib dependency
  python3 dataAdminTemplate.py \\
      --remote-url https://osmbc.example.com --api-key <your-key> \\
      --min-blog-number 300 --max-blog-number 320   # dry-run, prints the plan per blog
  python3 dataAdminTemplate.py ... --commit          # actually writes

Add --insecure ONLY when --remote-url points at a local dev server with a
self-signed cert - never for a real remote, it disables TLS verification
(mirrors syncBlog.js's own --insecure flag, same caveat).
"""

import argparse
import json
import re
import sys
from urllib.parse import quote

import requests

# Matches a markdown link whose target got accidentally double-wrapped in
# parens, e.g. "[some text]((https://example.org/page))" instead of the
# correct "[some text](https://example.org/page)" - a real class of markdown
# issue osmbc's own editor tolerates but a stricter renderer (Hugo) does
# not. Adapt this pattern (and DOUBLE_PAREN_LINK_FIX below) to whatever your
# own job actually needs to find - this is here as a concrete, runnable
# illustration of the shape, not a claim that it covers every real case.
DOUBLE_PAREN_LINK = re.compile(r"\]\(\((https?://[^()]+)\)\)")


def fix_double_paren_links(markdown):
    """Returns (new_text, changed) - the example transformation."""
    new_text = DOUBLE_PAREN_LINK.sub(r"](\1)", markdown)
    return new_text, new_text != markdown


def fetch_remote_blog(remote_url, api_key, blog_name, verify):
    """GET one blog + all its articles as raw JSON - EVERY article already
    carries every configured language's markdown<LANG> field, so this is
    the only network call needed per blog, however many languages you loop
    over below.

    Response shape: {"blog": {...}, "articles": [...], "trackedFields": [...],
    ...} - see docs/API.md `GET /api/blogSync/:apiKey/:blog_id`. An article
    field OSMBC has no value for comes back as "" (never omitted) - that
    sentinel is what setAndSave's own optimistic-concurrency check expects
    as "caller correctly believes there is no prior value", so treat a
    missing/empty field as "" too when building `old`, not None/absent.
    """
    url = f"{remote_url.rstrip('/')}/api/blogSync/{quote(api_key, safe='')}/{quote(blog_name, safe='')}"
    response = requests.get(url, verify=verify, timeout=30)
    if response.status_code == 404:
        return None  # no such blog - the range below is generated numerically, gaps are expected
    if response.status_code != 200:
        raise RuntimeError(f"GET {url} -> HTTP {response.status_code}: {response.text}")
    return response.json()


def apply_remote(remote_url, api_key, blog_name, body, verify):
    """POST a plan to the write endpoint. See docs/API.md
    `POST /api/blogSync/:apiKey/:blog_id/apply` for the full body/response
    shape, and routes/api.js applyBlogSync for the server-side behavior:
    - `maxBlogNumber` and the blog's `status === "closed"` are re-checked
      server-side, never trusted from this script alone (safety net a).
    - a conflict on one item (409-shaped, reported in the response's
      `conflicts`/`errors`) never aborts the rest of that blog's batch.
    - the blog is temporarily reopened and restored around the whole write
      (see wp-reconcile/blog-sync-merger/withReopenedBlog.js) - normal,
      expected, nothing your script needs to handle.
    """
    url = f"{remote_url.rstrip('/')}/api/blogSync/{quote(api_key, safe='')}/{quote(blog_name, safe='')}/apply"
    response = requests.post(url, json=body, verify=verify, timeout=120)
    if response.status_code != 200:
        raise RuntimeError(f"POST {url} -> HTTP {response.status_code}: {response.text}")
    return response.json()


def compute_patches(remote_data):
    """*** Adapt this to your own change - copy the shape, swap the fix. ***

    Loops over every article and every markdown<LANG> field named in
    trackedFields (i.e. every configured language, whatever that list is
    on the target instance - never hardcode a language list yourself).
    Returns the `patches` the apply endpoint expects: a list of
    {"id": <remote article id>, "changes": {...}, "old": {...}} entries.
    `changes` carries only the fields you're actually setting; `old` must
    carry the CURRENT value of each of those same fields (from this same
    GET response) so setAndSave can detect if something else changed the
    article in between your read and your write.
    """
    markdown_fields = [f for f in remote_data["trackedFields"] if f.startswith("markdown")]
    patches = []
    for article in remote_data["articles"]:
        changes = {}
        old = {}
        for field in markdown_fields:
            current_text = article.get(field, "")
            new_text, changed = fix_double_paren_links(current_text)
            if changed:
                changes[field] = new_text
                old[field] = current_text
        if changes:
            patches.append({"id": article["id"], "changes": changes, "old": old})
    return patches


def build_apply_body(max_blog_number, dry_run, patches, creates=None):
    """Mirrors syncBlog.js's buildApplyBody() shape - see docs/API.md for
    the full field list (creates/patches/blogPatch/categories/closeFlags/
    mode). This template only ever patches existing articles; extend
    `creates` (a list of {"localId": ..., "fields": {...}}) yourself if your
    use case also needs to create new ones - remember `fields.predecessorId`
    may reference another entry's own `localId` in the SAME batch (resolved
    server-side once real ids are known, see blogSyncMerger.js
    remapPredecessorIds) rather than a remote id you'd have to look up.
    """
    return {
        "maxBlogNumber": max_blog_number,
        "dryRun": dry_run,
        "creates": creates or [],
        "patches": patches
    }


def blog_names_in_range(min_blog_number, max_blog_number):
    """WN issues are numbered sequentially (WN001, WN002, ...) but there is
    no "list all blogs" API - this just generates the candidate names for
    the range you asked for. fetch_remote_blog() returns None for any
    number that doesn't exist, quietly skipped below."""
    for n in range(min_blog_number, max_blog_number + 1):
        yield f"WN{n:03d}"


def run(remote_url, api_key, min_blog_number, max_blog_number, commit, verify):
    for blog_name in blog_names_in_range(min_blog_number, max_blog_number):
        remote_data = fetch_remote_blog(remote_url, api_key, blog_name, verify)
        if remote_data is None:
            continue
        patches = compute_patches(remote_data)
        if not patches:
            continue
        body = build_apply_body(max_blog_number, dry_run=not commit, patches=patches)
        action = "Patching" if commit else "Would patch"
        print(f"{blog_name}: {action} {len(patches)} article(s)...", file=sys.stderr)
        result = apply_remote(remote_url, api_key, blog_name, body, verify)
        print(json.dumps({"blog": blog_name, "result": result}, indent=2))
        if result.get("errors"):
            print(f"  {blog_name}: {len(result['errors'])} error(s) reported - review above.", file=sys.stderr)
        if result.get("conflicts"):
            print(f"  {blog_name}: {len(result['conflicts'])} conflict(s) - NOT overwritten, review manually.", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--remote-url", required=True, help="Base URL of the target OSMBC instance, e.g. https://osmbc.example.com")
    parser.add_argument("--api-key", required=True, help="Your own API key (see module docstring for setup)")
    parser.add_argument("--min-blog-number", required=True, type=int, help="First WN issue number to check (inclusive)")
    parser.add_argument("--max-blog-number", required=True, type=int, help="Last WN issue number to check (inclusive) - also the safety ceiling sent with every write")
    parser.add_argument("--commit", action="store_true", help="Actually write to the remote (default: dry-run, only prints what each blog would need)")
    parser.add_argument("--insecure", action="store_true", help="Skip TLS certificate verification - ONLY for a local dev server with a self-signed cert, never for a real remote")
    args = parser.parse_args()

    verify = not args.insecure
    if args.insecure:
        print("--insecure given: TLS certificate verification is OFF for this run.", file=sys.stderr)
        requests.packages.urllib3.disable_warnings()  # pylint: disable=no-member

    print(f"Remote side: {args.remote_url}, blogs WN{args.min_blog_number:03d}-WN{args.max_blog_number:03d}", file=sys.stderr)
    run(args.remote_url, args.api_key, args.min_blog_number, args.max_blog_number, args.commit, verify)
    if not args.commit:
        print("Dry-run only (pass --commit to actually write).", file=sys.stderr)


if __name__ == "__main__":
    main()
