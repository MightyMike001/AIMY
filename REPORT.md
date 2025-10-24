# AIMY – Logic & Architecture Review

## Overzicht
| Probleem | Bestanden | Ernst | Fix-samenvatting |
| --- | --- | --- | --- |
| Opslaglaag gekoppeld aan UI rendering | `scripts/storage.js`, `scripts/messages.js`, `scripts/chat-page.js` | Hoog | Storage-functies ontdubbeld van DOM-manipulatie; nieuwe `renderMessages` in viewlaag en herstelpad logging toegevoegd. |
| Dubbele conversatieserialisatie (messages/docIds/prechat) | `scripts/chat.js`, `scripts/domain/conversation.js`, `scripts/storage.js` | Midden | Gemeenschappelijke functies voor sanitisatie, payloads en history-entry naar nieuw `scripts/domain/conversation.js` verplaatst en overal hergebruikt. |

## Dependencygraph bevindingen
- `scripts/chat-page.js` fungeert als orchestrator en importeert 10+ modules. Geen directe circular dependencies, maar eerdere koppeling `storage.js → ingest.js → storage.js` werd voorkomen door de nieuwe domeinlaag.
- Grootste modules (LOC): `scripts/chat-page.js` (~210 LOC) en `scripts/ingest.js` (~180 LOC). Geen bestanden >500 LOC.
- Nieuwe domeinlaag (`scripts/domain/conversation.js`) centraliseert conversielogica en wordt gebruikt door zowel netwerk- (`chat.js`) als storage-laag, waarmee dubbele bronnen van waarheid zijn verwijderd.

## Voorgestelde lagenstructuur
- **domain/**: pure conversatie- en geschiedenislogica (`scripts/domain/conversation.js`).
- **infrastructure/**: opslag (`scripts/storage.js`), configuratie (`scripts/config.js`).
- **ui/**: pagina-controllers (`scripts/chat-page.js`, `scripts/prechat-page.js`), component rendering (`scripts/messages.js`, `scripts/ingest.js`).
- Plaats toekomstige IO (fetch, storage) achter adapters in infrastructure en laat domain puur datatransformaties doen.

## Tests
- Geen formele test- of buildscripts aangetroffen; handmatig testen vereist.

## TODO
- [ ] (M) `scripts/chat-page.js` opdelen in aparte compositie-modules (settings, prechat, init) om orchestrator-rol te verkleinen.
- [ ] (S) `scripts/ingest.js` uploadpad abstraheren naar infrastructuurlaag zodat fetch/DOM gescheiden worden.
- [ ] (M) Conversatie-domein uitbreiden met exhaustieve state-types (discriminated unions) voor streamingstatus.
