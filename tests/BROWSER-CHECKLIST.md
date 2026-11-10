# Manuell webbläsarkontroll

Kör checklistan separat i aktuell Brave- och Chrome-version på Windows. Automatiska Node-tester ersätter inte kontroller av webbläsarens filväljare eller högerklicksmeny.

## Sparflöde och mappminne

1. Läs in tillägget opackat och öppna en vanlig HTTPS-sida.
2. Högerklicka på tilläggsikonen och kontrollera att **Spara aktuell sida som PDF** visas.
3. Välj åtgärden, klicka på **Spara som PDF** och välj en mapp, exempelvis `Dokument\PDF-test`.
4. Spara en PDF till. Kontrollera att filväljaren öppnas i samma mapp utan att bläddra dit igen.
5. Välj en annan mapp i filväljaren, spara och öppna den igen. Kontrollera att den nya mappen nu används.
6. Upprepa efter att ha stängt och öppnat webbläsaren.
7. I inställningarna, kör **Sparningsdiagnostik**. Notera stödet för filväljare, startmappsval och lagring.
8. Om inställningen för en sparad mapp stöds, välj mapp A. Kontrollera att den används som startmapp första gången; välj sedan mapp B i filväljaren och verifiera att B används vid nästa sparning.
9. Stäng av frågan-var-ska-sparas och kontrollera att direkt sparning till den valda mappen inte skapar undermappar.
10. Testa både **Behåll båda med numrering** och **Ersätt befintlig fil** vid direktsparning eller reservnedladdning. När filväljaren används kontrollerar du webbläsarens egen överskrivningsfråga.

## PDF-profiler, status och tangentbord

11. Ställ in olika profiler på två webbplatser och kontrollera att exempelvis artikelläge eller mörk utskrift bara används på den valda webbplatsen.
12. Spara en lång sida och kontrollera att panelen visar förberedelse, PDF-skapande, eventuell sidkontroll och sparning.
13. Navigera inställningar och sparpanel med Tab, Skift+Tab, Enter och Mellanslag. Kontrollera att fokusmarkeringen syns.
14. Kontrollera att skärmläsare läser upp fel, sparstatus och pågående steg.
15. Avbryt filväljaren och kontrollera att ingen PDF sparas och att nästa försök fungerar.

Anteckna webbläsare/version, operativsystem, vilka filväljar-API:er diagnostiken visar och vilket steg som eventuellt inte fungerar. Dela aldrig filinnehåll eller privata sökvägar i en felrapport.
