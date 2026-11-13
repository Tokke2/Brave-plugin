# Manuell webbläsarkontroll

Kör checklistan separat i aktuell Brave- och Chrome-version på Windows, macOS och Linux. Tillägget använder Chromium-API:er och inga OS-specifika binärer; filväljare och mappminne kan ändå skilja sig mellan webbläsare och operativsystem. Automatiska Node-tester ersätter inte kontroller i webbläsaren.

## Plattformar

- På Windows, macOS och Linux, läs in samma opackade mapp i Brave respektive Chrome och kontrollera att tillägget startar, visar ikonen och kan spara en vanlig HTTPS-sida.
- På varje kombination, kontrollera att om filväljar-API:t saknas fungerar webbläsarens reservdialog och att systemets visning av sökvägar inte orsakar fel.
- Bekräfta att snabbtangenter och högerklicksmenyn går att använda på varje operativsystem. Vänsterklick på tilläggsikonen ska spara PDF även från en webbplats som inte lagts till; högerklick ska erbjuda **Inställningar**. Anteckna OS, webbläsare och version; systemfältet ingår inte eftersom tillägget inte är ett fristående skrivbordsprogram.

## Sparflöde och mappminne

1. Läs in tillägget opackat och öppna en vanlig HTTPS-sida.
2. Kontrollera att webbplatsen inte finns i listan över tillagda webbplatser.
3. Vänsterklicka på tilläggsikonen. Kontrollera att PDF-sparningen startar utan att lägga till webbplatsen och välj en mapp, exempelvis `Dokument\PDF-test`.
4. Högerklicka på tilläggsikonen, välj **Inställningar** och kontrollera att inställningssidan öppnas.
5. Spara en PDF till. Kontrollera att filväljaren öppnas i samma mapp utan att bläddra dit igen.
6. Välj en annan mapp i filväljaren, spara och öppna den igen. Kontrollera att den nya mappen nu används.
7. Upprepa efter att ha stängt och öppnat webbläsaren.
8. I inställningarna, kör **Sparningsdiagnostik**. Notera stödet för filväljare, startmappsval och lagring.
9. Om inställningen för en sparad mapp stöds, välj mapp A. Kontrollera att den används som startmapp första gången; välj sedan mapp B i filväljaren och verifiera att B används vid nästa sparning.
10. Stäng av frågan-var-ska-sparas och kontrollera att direkt sparning till den valda mappen inte skapar undermappar.
11. Testa både **Behåll båda med numrering** och **Ersätt befintlig fil** vid direktsparning eller reservnedladdning. När filväljaren används kontrollerar du webbläsarens egen överskrivningsfråga.

## PDF-profiler, status och tangentbord

12. Ställ in olika profiler på två webbplatser och kontrollera att exempelvis artikelläge eller mörk utskrift bara används på den valda webbplatsen.
13. Spara en lång sida och kontrollera att panelen visar förberedelse, PDF-skapande, eventuell sidkontroll och sparning.
14. Navigera inställningar och sparpanel med Tab, Skift+Tab, Enter och Mellanslag. Kontrollera att fokusmarkeringen syns.
15. Kontrollera att skärmläsare läser upp fel, sparstatus och pågående steg.
16. Avbryt filväljaren och kontrollera att ingen PDF sparas och att nästa försök fungerar.

## Förhandsvisning, rullning och gränssnitt

17. På en lång sida med lazy-laddade bilder eller avsnitt, spara med **Ladda innehåll medan sidan rullas igenom** av respektive på. Kontrollera att nya avsnitt kommer med och att sidans ursprungliga scrollposition återställs.
18. Öppna **Förhandsgranska artikelinnehåll**. Jämför rubriker, bilder och text med källsidan. Med artikelläget på ska förhandsvisningen motsvara artikelurvalet; med det av ska den tydligt ange att PDF:en ändå skrivs ut från hela sidan.
19. Ändra marginal, bakgrund, sidfot och vattenstämpel i PDF-inställningarna. Kontrollera att skissen och sammanfattningen uppdateras medan fälten ändras.
20. Välj kompakt layout, öppna popupen och inställningarna på nytt och kontrollera att valet finns kvar. Upprepa med rymlig layout och kontrollera att text och kontroller fortfarande är läsbara.
21. Öppna snabbtangentdialogen. Kontrollera att båda kommandona och deras aktuella genvägar visas. Välj **Ändra i webbläsaren**, ändra en genväg där och verifiera att den nya genvägen visas nästa gång dialogen öppnas.

Anteckna webbläsare/version, operativsystem, vilka filväljar-API:er diagnostiken visar och vilket steg som eventuellt inte fungerar. Dela aldrig filinnehåll eller privata sökvägar i en felrapport.
