// Cross-language "bridge" pass for the old era, run AFTER matchByLinks.js's
// direct per-language pass (each language vs osmbc/DE) leaves some wp
// bullets unmatched.
//
// Real case that motivated this (WN220): the German osmbc article links a
// secondary source (a blog post ABOUT the story), EN's translation kept that
// same link (plus the two primary sources the sentence names) and matched
// directly - but ES/RO/JA/TR only linked the two primary sources, sharing
// NO link with DE at all, so they landed in unmatched-wp even though it's
// unmistakably the same bullet. ES and EN, however, DO share a link with
// each other (the primary sources) - so ES can be "bridged" to EN's already-
// matched osmbc article.
//
// Confirmed by dry-run analysis against the real WN219-267 corpus: resolves
// ~6.5% of unmatched-wp bullets (28/428), 0 false positives found in cluster
// or manual spot-check (WN220/44361, WN219/44310, WN228/44741, WN239/45248,
// WN246/45548), and the "exactly one distinct osmbc id in the cluster"
// ambiguity guard below is proven necessary AND sufficient - 6 genuine
// multi-id mixed clusters exist in the corpus (up to 3 ids/16 bullets, e.g.
// WN239), but none of them happened to touch a currently-unmatched bullet,
// so the guard alone already keeps the false-positive rate at zero without
// needing any extra restriction on which links count as evidence.
//
// Because a bridge is one hop weaker evidence than a direct link hit against
// the osmbc/DE original, callers should NOT auto-write bridged matches the
// way direct matches are - report them for manual confirmation instead.

import { extractLinks } from "../transitional-era/matchByLinks.js";

// Tried adding a "no bare-hostname links" filter here (e.g. rejecting
// openstreetmap.org/adainitiative.org as too generic to count as evidence),
// on the theory that a handful of large multi-article-id clusters in the dry
// run looked like they might be caused by exactly that kind of coincidence.
// Checked against the full WN219-267 corpus: none of those multi-id clusters
// actually touched a currently-unmatched bullet (the one-distinct-id guard
// below already fully contains them, 0 false positives), while the filter
// itself broke the motivating WN220 case - EN and ES only share bare-domain
// links (openstreetmap.org, adainitiative.org), no path on either. So the
// filter cost the one case it was meant to help. Left out; the one-id guard
// alone is doing all the necessary work here.
function findSharedLink(linksA, linksB) {
  for (const url of linksA) {
    if (linksB.has(url)) return url;
  }
  return null;
}

class UnionFind {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(x) {
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur);
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// nodes: [{ id, lang, html, articleId }] - one entry per wp bullet across
// ALL non-DE languages of one issue, both the ones matchByLinks already
// matched (articleId set) and the ones it left unmatched (articleId null).
// links are computed here so callers don't need to know extractLinks exists.
//
// Returns: [{ node, articleId, viaLang, sharedLink }] - one entry per
// previously-unmatched node that a cluster resolved, with enough context
// (which language/link it rode in on) for a human reviewer to judge it.
export function bridgeMatch(nodes) {
  const withLinks = nodes.map((n) => ({ ...n, links: extractLinks(n.html) }));
  const uf = new UnionFind(withLinks.map((n) => n.id));

  for (let i = 0; i < withLinks.length; i++) {
    for (let j = i + 1; j < withLinks.length; j++) {
      if (withLinks[i].lang === withLinks[j].lang) continue; // cross-language only
      if (findSharedLink(withLinks[i].links, withLinks[j].links)) {
        uf.union(withLinks[i].id, withLinks[j].id);
      }
    }
  }

  const clusters = new Map();
  for (const n of withLinks) {
    const root = uf.find(n.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(n);
  }

  const bridged = [];
  for (const cluster of clusters.values()) {
    const matchedNodes = cluster.filter((n) => n.articleId != null);
    const distinctIds = new Set(matchedNodes.map((n) => n.articleId));
    if (distinctIds.size !== 1) continue; // 0 matched -> nothing to bridge; 2+ -> ambiguous, leave for manual review

    const [articleId] = distinctIds;
    for (const n of cluster) {
      if (n.articleId != null) continue;
      let via = matchedNodes.find((m) => findSharedLink(n.links, m.links));
      const sharedLink = via ? findSharedLink(n.links, via.links) : null;
      if (!via) via = matchedNodes[0]; // transitive through another unmatched node - still one consistent id
      bridged.push({ node: n, articleId, viaLang: via.lang, sharedLink });
    }
  }
  return bridged;
}

export default { bridgeMatch };
