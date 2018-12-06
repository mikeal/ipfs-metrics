

## Identify Related Repositories

Before running this query, make sure that the table
`bigquery-public-data:github_repos.contents` has been updated *after* the
date range you're interested in looking at. This table appears to be updated
on Thursdays but there is no guarantee. If you don't wait for this update
you'll miss any newly created repositories that happened after the last
update.

We permanently store a list of repositories we've found in this repo.
Because we can only query a **current** snapshot of the data on the GitHub
but we will eventually need to parse through GitHub activity data from prior
time periods this is the best way we have to accumulate a better list of
repositories over time regardless of changes or moves/renames that might
occur. This means that our historical data gets a little less accurate the
farther back in time we go.

