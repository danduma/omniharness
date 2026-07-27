# Markdown File-Link Parsing Must Not Throw

**Date:** 2026-07-25
**Context:** Rendering agent Markdown with automatic project-file links
**Symptom:** A conversation containing inline code with a literal or malformed percent sequence crashed the entire React page with `URIError: URI malformed`.
**Root Cause:** Every Markdown code span was tested as a possible project path, and path normalization called `decodeURIComponent` on the whole value without handling malformed input. Ordinary text such as `100%` therefore escaped the parser boundary as an exception.
**Fix:** Decode only syntactically valid runs of percent-encoded bytes and preserve literal or invalid percent sequences. File-link detection can now reject non-path text without throwing.
**Verification:** Regression tests cover both direct path parsing and rendering Markdown containing `` `100%` ``. The focused parser and Markdown suite passes 19 tests.
**Prevention:** Parsers that inspect untrusted agent output must be total functions: malformed candidates should return no match or preserve the input, never throw through the React render tree.
**Skill/Doc Updates:** No general skill update was needed because the debugging guidance already requires reproducing malformed boundary input and fixing it at the parser.
