'use strict';
// E-Rechnung: eine gestellte Rechnung als strukturierter Datensatz nach
// EN 16931, in der Syntax UN/CEFACT Cross Industry Invoice (CII) und der
// deutschen Auspraegung XRechnung.
//
// Zwei Grundsaetze:
//
// 1. Hier wird nichts gerechnet. Jeder Betrag stammt aus der Abschrift der
//    Rechnung (siehe rechnung.js). Die XML-Datei ist dieselbe Rechnung in
//    anderer Form, keine zweite Rechnung — eine eigene Formel waere der
//    sicherste Weg, dass beide eines Tages verschiedene Summen tragen.
//
// 2. Lieber keine Datei als eine unvollstaendige. Fehlt eine Pflichtangabe,
//    bricht der Export ab und nennt sie. Ein XML mit leerem Pflichtfeld sieht
//    fertig aus und wird erst beim Empfaenger zurueckgewiesen.
//
// Was die Datei NICHT leistet: uebermitteln (Upload, E-Mail, Peppol macht der
// Nutzer), Anlagen einbetten, Skonto, mehrere Steuersaetze je Rechnung,
// Reverse Charge, ZUGFeRD-PDF.
const rechnung = require('./rechnung');

// Welche Fassung der Spezifikation die Datei erfuellt. Die KoSIT veroeffentlicht
// zum 31.01. und 31.07. neue Fassungen, gueltig je ein halbes Jahr spaeter —
// diese Zeile ist der Ort, an dem ein Versionswechsel nachgezogen wird.
const SPEZIFIKATION = 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0';
const GESCHAEFTSPROZESS = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

const BEFREIUNG_KLEINUNTERNEHMER =
  'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG';

// Leitweg-ID: Grobadressierung, optional Feinadressierung, zweistellige
// Pruefziffer. Adressiert Rechnungsempfaenger der oeffentlichen Verwaltung.
const LEITWEG_RE = /^\d{2,12}(-[A-Za-z0-9]{1,30})?-\d{2}$/;

// Maskiert Text fuer XML und entfernt Zeichen, die XML 1.0 nicht kennt:
// Steuerzeichen, U+FFFE/U+FFFF und einzelne Haelften eines Surrogatpaars.
// Ein einziges davon macht die ganze Datei unlesbar.
const KEIN_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function x(s) {
  return String(s == null ? '' : s)
    .replace(KEIN_XML, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function betrag(n) {
  return (Number(n) || 0).toFixed(2);
}

// Datum im Format 102 (JJJJMMTT). Tagesangaben kommen als "JJJJ-MM-TT",
// Zeitstempel als ISO-Zeit — dort zaehlt der Kalendertag am Ort des
// Ausstellers, wie auf der Druckansicht.
function datum102(wert) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(wert))) return String(wert).replace(/-/g, '');
  const d = new Date(wert);
  const zwei = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + zwei(d.getMonth() + 1) + zwei(d.getDate());
}

function datumElement(name, wert) {
  return `<ram:${name}><udt:DateTimeString format="102">${datum102(wert)}</udt:DateTimeString></ram:${name}>`;
}

// Die Anschrift liegt als Zeilenliste vor. Die Norm will Postleitzahl und Ort
// getrennt: sie stehen in der letzten Zeile ("50667 Koeln"), alles davor sind
// Adresszeilen. Laesst sich die letzte Zeile nicht so lesen, gilt die Anschrift
// als unvollstaendig — geraten wird nicht.
//
// Fuer Deutschland wird die Form geprueft (fuenf Ziffern): "D-50667 Koeln"
// ginge sonst mit "D-50667" als Postleitzahl hinaus. Fuer andere Laender gilt
// die einfache Regel "erstes Wort mit Ziffer, dann der Ort" — sie passt auf
// Oesterreich und die Schweiz, bei Formen wie "1012 AB Amsterdam" nicht.
function anschriftTeile(zeilen, landKuerzel) {
  const liste = (Array.isArray(zeilen) ? zeilen : []).map((z) => String(z).trim()).filter(Boolean);
  if (liste.length === 0) return null;
  const m = liste[liste.length - 1].match(/^(\S*\d\S*)\s+(\S.*)$/);
  if (!m) return null;
  if (landKuerzel === 'DE' && !/^\d{5}$/.test(m[1])) return null;
  return { plz: m[1], ort: m[2], zeilen: liste.slice(0, -1) };
}

// Gehen die Summen der Abschrift auf? Gerechnet wird in Cent, damit kein
// Rundungsrest eine stimmige Rechnung verwirft.
function summenStimmen(inv) {
  const zahl = (n) => typeof n === 'number' && Number.isFinite(n);
  const cent = (n) => Math.round(n * 100);
  const betraege = [inv.netto_eur, inv.ust_eur, inv.brutto_eur, ...inv.positionen.map((p) => p.betrag_eur)];
  if (!betraege.every(zahl)) return false;
  const positionen = inv.positionen.reduce((s, p) => s + cent(p.betrag_eur), 0);
  return positionen === cent(inv.netto_eur) && cent(inv.netto_eur) + cent(inv.ust_eur) === cent(inv.brutto_eur);
}

function land(wert) {
  const s = String(wert || 'DE').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

// Elektronische Adresse des Empfaengers: seine E-Mail, bei Behoerden ersatzweise
// die Leitweg-ID (Schema 0204).
function adresseEmpfaenger(e) {
  if (e.email && String(e.email).includes('@')) return { schema: 'EM', wert: String(e.email).trim() };
  if (LEITWEG_RE.test(String(e.kaeufer_referenz || ''))) return { schema: '0204', wert: e.kaeufer_referenz };
  return null;
}

// Steuerkategorie der Rechnung. Eine je Rechnung — so rechnet auch rechnung.js.
function steuerkategorie(inv) {
  if (inv.kleinunternehmer) return { code: 'E', satz: 0, grund: BEFREIUNG_KLEINUNTERNEHMER };
  const satz = Number(inv.ust_prozent);
  if (Number.isFinite(satz) && satz > 0) return { code: 'S', satz, grund: null };
  return null;
}

// Was der Abschrift fuer eine gueltige E-Rechnung fehlt. Leere Liste = alles da.
// Die Namen gehen woertlich an die Oberflaeche.
function pruefe(inv) {
  const fehlt = [];
  if (!inv) return ['Rechnung'];
  const a = inv.aussteller || {};
  const e = inv.empfaenger || {};

  if (!a.name) fehlt.push('Aussteller: Name');
  if (!anschriftTeile(a.anschrift, land(a.land))) fehlt.push('Aussteller: Anschrift mit Postleitzahl und Ort in der letzten Zeile');
  if (!a.steuernummer && !a.ustIdNr) fehlt.push('Aussteller: Steuernummer oder USt-IdNr.');
  if (a.ustIdNr && !/^[A-Za-z]{2}/.test(String(a.ustIdNr).trim())) fehlt.push('Aussteller: USt-IdNr. mit Länderkürzel');
  if (!a.email || !String(a.email).includes('@')) fehlt.push('Aussteller: E-Mail');
  if (!/\d.*\d.*\d/.test(String(a.telefon || ''))) fehlt.push('Aussteller: Telefon');
  if (!a.iban) fehlt.push('Aussteller: IBAN');
  if (!land(a.land)) fehlt.push('Aussteller: Land als zweistelliges Kürzel');

  if (!e.name) fehlt.push('Empfänger: Name');
  if (!anschriftTeile(e.anschrift, land(e.land))) fehlt.push('Empfänger: Anschrift mit Postleitzahl und Ort in der letzten Zeile');
  if (e.ust_id_nr && !/^[A-Za-z]{2}/.test(String(e.ust_id_nr).trim())) fehlt.push('Empfänger: USt-IdNr. mit Länderkürzel');
  if (!e.kaeufer_referenz) fehlt.push('Empfänger: Käuferreferenz');
  if (!adresseEmpfaenger(e)) fehlt.push('Empfänger: E-Mail oder Leitweg-ID');
  if (!land(e.land)) fehlt.push('Empfänger: Land als zweistelliges Kürzel');

  // Aeltere Abschriften wurden ohne Formpruefung gespeichert. Ein Zeitraum, der
  // kein Datum ist, ergaebe ein erfundenes Datum in der Datei.
  const tag = /^\d{4}-\d{2}-\d{2}$/;
  if (!tag.test(String(inv.leistung_von)) || !tag.test(String(inv.leistung_bis))) fehlt.push('Leistungszeitraum als Datum');
  if (Number.isNaN(new Date(inv.erstellt_am).getTime())) fehlt.push('Rechnungsdatum');

  if (!Array.isArray(inv.positionen) || inv.positionen.length === 0) fehlt.push('Positionen');
  else if (!summenStimmen(inv)) fehlt.push('Summen der Rechnung');
  if (!steuerkategorie(inv)) fehlt.push('Steuersatz über 0 oder Kleinunternehmerregelung');
  return fehlt;
}

// Menge, Einheit und Einzelpreis einer Position.
//
// Stundenposition: der Preis ist der vereinbarte Satz und bleibt unangetastet.
// Die Menge wird aus Betrag und Satz zurueckgerechnet und mit mehr Stellen
// ausgegeben als auf der Druckansicht — der Betrag der Abschrift entstand aus
// ungerundeten Stunden, und Menge mal Preis muss ihn wieder ergeben.
//
// Pauschalposition: ein Stueck zum Festpreis. Beim Storno ist der Betrag
// negativ; negativ wird dann die Menge, der Preis bleibt positiv (die Norm
// verbietet negative Preise).
function mengeUndPreis(p) {
  const netto = Number(p.betrag_eur) || 0;
  const satz = Number(p.satz);
  const pauschal = p.typ === 'pauschal' || typeof p.stunden !== 'number' || !(satz > 0);
  if (pauschal) {
    return { menge: netto < 0 ? '-1' : '1', einheit: 'C62', preis: betrag(Math.abs(netto)) };
  }
  // Vier Nachkommastellen genuegen fast immer; reichen sie nicht, um den Betrag
  // zu treffen, werden es acht. Ausgegeben wird ueber toFixed und ohne
  // angehaengte Nullen — String(1e-7) ergaebe "1e-7", und das ist keine
  // gueltige Dezimalzahl in XML.
  const dezimal = (stellen) => {
    const text = (netto / satz).toFixed(stellen).replace(/\.?0+$/, '');
    return text === '-0' || text === '' ? '0' : text;
  };
  let menge = dezimal(4);
  if (Math.abs(Math.round(Number(menge) * satz * 100) / 100 - netto) >= 0.005) menge = dezimal(8);
  return { menge, einheit: 'HUR', preis: betrag(satz) };
}

function position(p, nr, steuer) {
  const { menge, einheit, preis } = mengeUndPreis(p);
  const name = p.bezeichnung || ('Entwicklungsleistung Vorgang ' + p.ticket);
  const zeitraum = p.von && p.bis && p.von <= p.bis
    ? `<ram:BillingSpecifiedPeriod>${datumElement('StartDateTime', p.von)}${datumElement('EndDateTime', p.bis)}</ram:BillingSpecifiedPeriod>`
    : '';
  return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${nr}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${x(name)}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice><ram:ChargeAmount>${preis}</ram:ChargeAmount></ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${einheit}">${menge}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${steuer.code}</ram:CategoryCode>
          <ram:RateApplicablePercent>${steuer.satz}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        ${zeitraum}
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${betrag(p.betrag_eur)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
}

function postanschrift(teile, landKuerzel) {
  const namen = ['LineOne', 'LineTwo', 'LineThree'];
  // Mehr als drei Adresszeilen kennt die Norm nicht: der Rest rueckt in die dritte.
  const zeilen = teile.zeilen.length > 3
    ? [teile.zeilen[0], teile.zeilen[1], teile.zeilen.slice(2).join(', ')]
    : teile.zeilen;
  return `<ram:PostalTradeAddress>
          <ram:PostcodeCode>${x(teile.plz)}</ram:PostcodeCode>
          ${zeilen.map((z, i) => `<ram:${namen[i]}>${x(z)}</ram:${namen[i]}>`).join('')}
          <ram:CityName>${x(teile.ort)}</ram:CityName>
          <ram:CountryID>${landKuerzel}</ram:CountryID>
        </ram:PostalTradeAddress>`;
}

// Die Rechnung als CII-XML. Wirft, wenn der Abschrift eine Pflichtangabe fehlt;
// der Fehler traegt die Liste in `fehlt`.
function alsXml(inv) {
  const fehlt = pruefe(inv);
  if (fehlt.length) {
    const err = new Error(
      'Für die E-Rechnung fehlen: ' + fehlt.join(', ') + '. Eine gestellte Rechnung bleibt ' +
      'unverändert — Angaben ergänzen, Rechnung stornieren und neu stellen.'
    );
    err.fehlt = fehlt;
    throw err;
  }

  const a = inv.aussteller;
  const e = inv.empfaenger;
  const steuer = steuerkategorie(inv);
  const storno = inv.status === 'storno';
  const adresseE = adresseEmpfaenger(e);
  const faellig = rechnung.faelligAm(inv);
  const istForderung = Number(inv.brutto_eur) > 0;

  // Zahlungsbedingungen als Text. Bei einem Storno gibt es nichts zu zahlen.
  const bedingung = storno
    ? `Storno zu Rechnung ${inv.storno_von}. Es ist kein Betrag zu zahlen.`
    : `Zahlbar ohne Abzug bis ${new Date(faellig + 'T12:00:00').toLocaleDateString('de-DE')}.`;

  // Kennung des Ausstellers (BT-29). Die Norm verlangt, dass der Empfaenger
  // den Aussteller maschinell erkennt: an der USt-IdNr. oder an einer Kennung
  // (Regel BR-CO-26). Vorrang hat die Lieferantennummer, die der Kunde vergeben
  // hat. Wer keine USt-IdNr. fuehrt — der Normalfall bei Kleinunternehmern —
  // wird ersatzweise an der Steuernummer erkannt; die steht ohnehin im Dokument.
  const kennung = e.lieferantennummer || (a.ustIdNr ? '' : a.steuernummer);

  const steuerIds = [
    a.ustIdNr ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(String(a.ustIdNr).replace(/\s+/g, ''))}</ram:ID></ram:SpecifiedTaxRegistration>` : '',
    a.steuernummer ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${x(a.steuernummer)}</ram:ID></ram:SpecifiedTaxRegistration>` : '',
  ].join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${GESCHAEFTSPROZESS}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${SPEZIFIKATION}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${x(inv.nr)}</ram:ID>
    <ram:TypeCode>${storno ? '384' : '380'}</ram:TypeCode>
    ${datumElement('IssueDateTime', inv.erstellt_am)}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${inv.positionen.map((p, i) => position(p, i + 1, steuer)).join('')}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${x(e.kaeufer_referenz)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        ${kennung ? `<ram:ID>${x(kennung)}</ram:ID>` : ''}
        <ram:Name>${x(a.name)}</ram:Name>
        <ram:DefinedTradeContact>
          <ram:PersonName>${x(a.name)}</ram:PersonName>
          <ram:TelephoneUniversalCommunication><ram:CompleteNumber>${x(a.telefon)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>
          <ram:EmailURIUniversalCommunication><ram:URIID>${x(a.email)}</ram:URIID></ram:EmailURIUniversalCommunication>
        </ram:DefinedTradeContact>
        ${postanschrift(anschriftTeile(a.anschrift), land(a.land))}
        <ram:URIUniversalCommunication><ram:URIID schemeID="EM">${x(a.email)}</ram:URIID></ram:URIUniversalCommunication>
        ${steuerIds}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${x(e.name)}</ram:Name>
        ${postanschrift(anschriftTeile(e.anschrift), land(e.land))}
        <ram:URIUniversalCommunication><ram:URIID schemeID="${adresseE.schema}">${x(adresseE.wert)}</ram:URIID></ram:URIUniversalCommunication>
        ${e.ust_id_nr ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${x(String(e.ust_id_nr).replace(/\s+/g, ''))}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
      ${e.bestellnummer ? `<ram:BuyerOrderReferencedDocument><ram:IssuerAssignedID>${x(e.bestellnummer)}</ram:IssuerAssignedID></ram:BuyerOrderReferencedDocument>` : ''}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${x(String(a.iban).replace(/\s+/g, '').toUpperCase())}</ram:IBANID>
          <ram:AccountName>${x(a.name)}</ram:AccountName>
        </ram:PayeePartyCreditorFinancialAccount>
        ${a.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${x(a.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${betrag(inv.ust_eur)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        ${steuer.grund ? `<ram:ExemptionReason>${x(steuer.grund)}</ram:ExemptionReason>` : ''}
        <ram:BasisAmount>${betrag(inv.netto_eur)}</ram:BasisAmount>
        <ram:CategoryCode>${steuer.code}</ram:CategoryCode>
        <ram:RateApplicablePercent>${steuer.satz}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:BillingSpecifiedPeriod>${datumElement('StartDateTime', inv.leistung_von)}${datumElement('EndDateTime', inv.leistung_bis)}</ram:BillingSpecifiedPeriod>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${x(bedingung)}</ram:Description>
        ${istForderung ? datumElement('DueDateDateTime', faellig) : ''}
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${betrag(inv.netto_eur)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${betrag(inv.netto_eur)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${betrag(inv.ust_eur)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${betrag(inv.brutto_eur)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${betrag(inv.brutto_eur)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
      ${storno ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${x(inv.storno_von)}</ram:IssuerAssignedID></ram:InvoiceReferencedDocument>` : ''}
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`.replace(/^\s*\n/gm, '');
}

module.exports = { alsXml, pruefe, mengeUndPreis, SPEZIFIKATION };
