# Validierung: Exakte Engine vs. Wizard of Odds House-Edge-Tabelle

Erzeugt mit `npm run validate:wizard` am 2026-11-07 (Laufzeit 73 s).

**Referenz:** Wizard of Odds – Blackjack House Edge Calculator (Michael Shackleford), https://wizardofodds.com/games/blackjack/calculator/ — Seite veröffentlicht/aktualisiert 2026-08-03 (datePublished/dateModified of the page), abgerufen 2026-11-07.
Referenzspalte = „Optimal results“: perfekte kompositionsabhängige Strategie, Mischen nach jeder Hand.
Eigene Spalte = `generateStrategy(rules).houseEdge.cdOptimal` (kompositionsabhängig optimale Entscheidung je Zweikarten-Hand, frischer Schuh je Hand).
Die TD-Spalte zeigt zusätzlich den Hausvorteil der eigenen total-abhängigen Basic Strategy (Folgeentscheidungen nach dem ersten Zug kompositionsabhängig).

| Regeln | Wizard (optimal) | Engine (CD) | Differenz (%-Punkte) | Engine (TD-Basic) |
|---|---|---|---|---|
| 1D S17 noDAS dbl:any2 SP4 - - peek/OBO - | -0.0416 % | -0.0425 % | -0.0008 | -0.0296 % |
| 1D S17 noDAS dbl:any2 SP4 - - peek/OBO LS | -0.0637 % | -0.0645 % | -0.0008 | -0.0464 % |
| 1D S17 DAS dbl:any2 SP4 - - peek/OBO - | -0.1829 % | -0.1839 % | -0.0010 | -0.1711 % |
| 1D S17 DAS dbl:any2 SP4 - - peek/OBO LS | -0.2049 % | -0.2060 % | -0.0010 | -0.1879 % |
| 1D H17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.1518 % | 0.1512 % | -0.0006 | 0.1595 % |
| 1D H17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.1138 % | 0.1132 % | -0.0006 | 0.1281 % |
| 1D H17 DAS dbl:any2 SP4 - - peek/OBO - | 0.0077 % | 0.0072 % | -0.0005 | 0.0156 % |
| 1D H17 DAS dbl:any2 SP4 - - peek/OBO LS | -0.0303 % | -0.0308 % | -0.0005 | -0.0158 % |
| 2D S17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.3210 % | 0.3206 % | -0.0004 | 0.3239 % |
| 2D S17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.2698 % | 0.2694 % | -0.0004 | 0.2762 % |
| 2D S17 DAS dbl:any2 SP4 - - peek/OBO - | 0.1783 % | 0.1778 % | -0.0005 | 0.1812 % |
| 2D S17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.1272 % | 0.1266 % | -0.0005 | 0.1334 % |
| 2D H17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.5253 % | 0.5249 % | -0.0003 | 0.5258 % |
| 2D H17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.4591 % | 0.4588 % | -0.0003 | 0.4633 % |
| 2D H17 DAS dbl:any2 SP4 - - peek/OBO - | 0.3799 % | 0.3796 % | -0.0003 | 0.3804 % |
| 2D H17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.3137 % | 0.3134 % | -0.0003 | 0.3180 % |
| 4D S17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.4896 % | 0.4891 % | -0.0005 | 0.4900 % |
| 4D S17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.4228 % | 0.4224 % | -0.0005 | 0.4242 % |
| 4D S17 DAS dbl:any2 SP4 - - peek/OBO - | 0.3475 % | 0.3470 % | -0.0005 | 0.3479 % |
| 4D S17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.2807 % | 0.2802 % | -0.0005 | 0.2820 % |
| 4D H17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.7021 % | 0.7016 % | -0.0005 | 0.7016 % |
| 4D H17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.6199 % | 0.6195 % | -0.0004 | 0.6204 % |
| 4D H17 DAS dbl:any2 SP4 - - peek/OBO - | 0.5572 % | 0.5567 % | -0.0005 | 0.5567 % |
| 4D H17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.4751 % | 0.4747 % | -0.0004 | 0.4755 % |
| 6D S17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.5449 % | 0.5444 % | -0.0005 | 0.5446 % |
| 6D S17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.4723 % | 0.4718 % | -0.0005 | 0.4721 % |
| 6D S17 DAS dbl:any2 SP4 - - peek/OBO - | 0.4031 % | 0.4026 % | -0.0005 | 0.4028 % |
| 6D S17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.3305 % | 0.3300 % | -0.0005 | 0.3303 % |
| 6D H17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.7602 % | 0.7597 % | -0.0005 | 0.7597 % |
| 6D H17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.6719 % | 0.6714 % | -0.0005 | 0.6715 % |
| 6D H17 DAS dbl:any2 SP4 - - peek/OBO - | 0.6156 % | 0.6151 % | -0.0005 | 0.6151 % |
| 6D H17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.5274 % | 0.5269 % | -0.0005 | 0.5270 % |
| 8D S17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.5725 % | 0.5719 % | -0.0006 | 0.5719 % |
| 8D S17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.4967 % | 0.4961 % | -0.0006 | 0.4961 % |
| 8D S17 DAS dbl:any2 SP4 - - peek/OBO - | 0.4310 % | 0.4303 % | -0.0006 | 0.4303 % |
| 8D S17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.3551 % | 0.3545 % | -0.0006 | 0.3545 % |
| 8D H17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.7892 % | 0.7887 % | -0.0005 | 0.7887 % |
| 8D H17 noDAS dbl:any2 SP4 - - peek/OBO LS | 0.6976 % | 0.6971 % | -0.0005 | 0.6971 % |
| 8D H17 DAS dbl:any2 SP4 - - peek/OBO - | 0.6449 % | 0.6443 % | -0.0006 | 0.6443 % |
| 8D H17 DAS dbl:any2 SP4 - - peek/OBO LS | 0.5534 % | 0.5528 % | -0.0006 | 0.5528 % |
| 6D S17 DAS dbl:9-11 SP4 - - peek/OBO - | 0.4992 % | 0.4987 % | -0.0005 | 0.4990 % |
| 6D S17 DAS dbl:10-11 SP4 - - peek/OBO - | 0.5952 % | 0.5946 % | -0.0006 | 0.5949 % |
| 6D S17 DAS dbl:any2 SP2 - - peek/OBO - | 0.4569 % | 0.4566 % | -0.0003 | 0.4569 % |
| 6D S17 DAS dbl:any2 SP3 - - peek/OBO - | 0.4118 % | 0.4102 % | -0.0016 | 0.4104 % |
| 6D S17 DAS dbl:any2 SP4 RSA - peek/OBO - | 0.3346 % | 0.3338 % | -0.0008 | 0.3341 % |
| 6D S17 DAS dbl:any2 SP4 - HSA peek/OBO - | 0.2157 % | 0.2152 % | -0.0005 | 0.2155 % |
| 6D S17 DAS dbl:any2 SP4 RSA HSA peek/OBO - | 0.1569 % | 0.1565 % | -0.0005 | 0.1567 % |
| 6D S17 DAS dbl:any2 SP4 - - ENHC - | 0.5142 % | 0.5137 % | -0.0004 | 0.5140 % |
| 6D H17 DAS dbl:any2 SP4 - - ENHC - | 0.7270 % | 0.7266 % | -0.0004 | 0.7266 % |
| 8D S17 DAS dbl:any2 SP4 - - ENHC - | 0.5426 % | 0.5421 % | -0.0005 | 0.5421 % |
| 1D H17 noDAS dbl:any2 SP4 - - peek/OBO - | 0.1518 % | 0.1512 % | -0.0006 | 0.1595 % |
| 2D H17 DAS dbl:any2 SP4 RSA - peek/OBO LS | 0.2606 % | 0.2609 % | +0.0003 | 0.2655 % |
| 5D S17 DAS dbl:any2 SP4 - - peek/OBO - | 0.3808 % | 0.3803 % | -0.0005 | 0.3809 % |
| 8D H17 DAS dbl:any2 SP4 RSA - peek/OBO LS | 0.4836 % | 0.4827 % | -0.0009 | 0.4827 % |
| 6D S17 noDAS dbl:9-11 SP2 - - ENHC - | 0.7758 % | 0.7755 % | -0.0002 | 0.7758 % |

**Ergebnis:** 55 Regelkonfigurationen, mittlere absolute Abweichung 0.0005 %-Punkte, maximale absolute Abweichung 0.0016 %-Punkte.
