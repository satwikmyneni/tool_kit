# SEO deployment checklist

The application now generates the on-site signals search engines need. Complete
this checklist for the real production domain; account ownership, DNS, hosting,
promotion, and rankings cannot be configured from the repository alone.

## 1. Publish one canonical HTTPS origin

Set these production environment variables:

```text
FLASK_ENV=production
SECRET_KEY=<long-random-production-secret>
BASE_URL=https://www.tools4all.in
SEO_INDEXING_ENABLED=true
```

`BASE_URL` must be the exact preferred origin. The preferred origin for this
project is `https://www.tools4all.in`; the apex domain must permanently redirect
to it. Render currently provides that redirect.

For preview and staging environments, always set:

```text
SEO_INDEXING_ENABLED=false
```

## 2. Verify search-engine ownership

Prefer DNS verification in Google Search Console because it covers the complete
domain. For URL-prefix verification, copy only the token value into:

```text
GOOGLE_SITE_VERIFICATION=<token>
```

Verify the site in Bing Webmaster Tools as well. Bing can import a verified
Search Console property. If meta verification is used instead, set:

```text
BING_SITE_VERIFICATION=<token>
```

Never commit real verification tokens to source control.

## 3. Submit and inspect

After the production release:

1. Open `https://www.tools4all.in/robots.txt` and confirm it links to the correct
   production sitemap.
2. Open `https://www.tools4all.in/sitemap.xml` and confirm every URL uses the
   canonical HTTPS origin.
3. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
4. Use URL Inspection for the home page, `/tools`, each category, and the most
   important tool pages. Test the live URL, then request indexing.
5. Run Google's Rich Results Test on a category page and a tool page. The markup
   describes the pages accurately but never fabricates reviews or ratings.

Set `SEO_LASTMOD` only when its W3C date or datetime is accurate for a significant
site-wide content release. Leave it blank otherwise. Search engines ignore
artificially refreshed dates.

## 4. Production performance and reliability

- Put the Flask application behind a production WSGI server and reverse proxy.
- Enable Brotli or gzip compression, HTTP/2 or HTTP/3, and long-lived caching for
  versioned static files.
- Keep server response times stable and monitor 5xx errors, timeouts, and uptime.
- Test representative mobile pages with PageSpeed Insights and fix any failing
  Core Web Vitals using field data from Search Console once traffic is available.
- Confirm Googlebot can fetch CSS, JavaScript, icons, and the social preview image.

## 5. Build rankings over time

Technical SEO makes pages eligible and understandable; it does not guarantee a
position. For durable first-page rankings:

- Use Search Console query data to find one clear search intent for each priority
  tool page, then improve that page with genuinely useful instructions, examples,
  limitations, and answers specific to the tool.
- Start with lower-competition, specific queries rather than trying to rank the
  home page for the broad phrase "online tools."
- Earn relevant editorial links by publishing useful tools and resources people
  choose to reference. Do not buy links or use automated link schemes.
- Monitor indexing, impressions, click-through rate, backlinks, Core Web Vitals,
  and conversions monthly. Improve weak pages instead of mass-producing thin or
  duplicated content.
- Keep calculations, file limits, provider disclosures, and privacy statements
  accurate as the implementation changes.

Ranking movement normally requires recrawling, indexing, accumulated engagement,
authority, and competitive comparison. Evaluate trends over weeks and months,
not immediately after deployment.
