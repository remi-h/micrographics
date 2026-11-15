-- Table privileges for signed-in users.
--
-- Projects that do not expose new tables to the Data API automatically give
-- the `authenticated` role no rights on tables made in SQL, and every request
-- the app sends is then refused before row-level security is consulted.
-- Granting them changes nothing about who sees what: the policies in the
-- first migration still limit each user to their own rows. Signed-out
-- visitors (`anon`) are deliberately given nothing.

grant select, insert, update, delete on public.canvases to authenticated;
grant select, insert, update, delete on public.symbols to authenticated;
