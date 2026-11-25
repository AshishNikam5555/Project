#!/usr/bin/env bash
# Runs migrations + seed + security tests on a throwaway local Postgres, then a
# concurrency test (two patients booking the same slot at the same moment).
# Needs: Postgres 14+ binaries (initdb, pg_ctl, psql). Does not touch Supabase.
set -euo pipefail
cd "$(dirname "$0")/../.."
PGBIN=${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
DATA=$(mktemp -d)
AS=""; if [ "$(id -u)" = 0 ]; then AS="runuser -u postgres --"; chown postgres "$DATA"; fi
PORT=${PORT:-55432}
SOCK=$DATA
trap '$AS "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT

$AS "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
$AS "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
PSQL="psql -h $SOCK -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

node tools/gen-seed-sql.js >/dev/null
$PSQL -f supabase/tests/_local_supabase_stub.sql
for f in supabase/migrations/*.sql; do $PSQL -f "$f"; done
$PSQL -f supabase/seed.sql
$PSQL -f supabase/tests/rls_test.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p; /^---/p; /ALL TESTS/p'

echo '--- concurrency ---'
D=$($PSQL -At -c "select min(d)::date from generate_series((now() at time zone 'Asia/Kolkata')::date + 1, (now() at time zone 'Asia/Kolkata')::date + 7, interval '1 day') d where extract(dow from d) between 1 and 6")
book() { $PSQL -At -c "set role anon; select token from public.create_booking('kadam-hospital','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000311','$D','13:30','Patient $1','98765000$1',30,null,null,true,'direct');" 2>&1; }
OUT=$(mktemp -d); for i in 11 12 13 14 15 16; do book $i > "$OUT/c$i" & done; wait
OK=$(grep -l '^KH-' "$OUT"/c* | wc -l); TAKEN=$(grep -l 'just taken' "$OUT"/c* | wc -l)
if [ "$OK" = 1 ] && [ "$TAKEN" = 5 ]; then echo "PASS 6 simultaneous bookings for one slot → 1 succeeded, 5 got 'slot was just taken'";
else echo "FAIL concurrency: ok=$OK taken=$TAKEN"; cat "$OUT"/c*; exit 1; fi
