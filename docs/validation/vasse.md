# Cas de validation résolus à la main

Chaque valeur ci-dessous est écrite en dur dans les tests (`tests/`), jamais
recalculée par eux. Les calculs ont été menés indépendamment du code.
S235, valeurs recommandées : γ_M0 = γ_M1 = 1,0 ; γ_M2 = 1,25 ; β_w = 0,80 ;
f_u / (β_w γ_M2) = 360 MPa ; 0,9 f_u / γ_M2 = 259,2 MPa.

## Modèle de la tête d'ancrage

```
      ||  [bloc]  ||        âmes : raidisseurs soudés sur la face libre
    ==++==+====+==++==      platine percée, posée sur le support
    ##################      béton (appui continu) ou lierne (appui aux extrémités)
```

La platine porte sur le support ; le bloc d'ancrage et le vérin prennent place
entre les âmes. Deux schémas :

- **appui continu (béton)** — la platine porte sur le béton : tronçon en T
  comprimé (EN 1993-1-8 §6.2.5). Les âmes collectent la pression sous leur
  bande et la ramènent, en poutres en T, vers la zone de la couronne.
- **appui aux extrémités (lierne, berlinoise)** — rien ne porte la platine
  entre ses appuis : elle franchit l'entraxe `e` et se suspend aux âmes ;
  platine et âmes forment une poutre de portée `L` dont la platine est la
  semelle **tendue** et le chant libre des âmes la fibre **comprimée**.

## VASSE-1 — appui continu sur béton

Platine 300 × 300 × 30, perçage 80 ; âmes 20 × 150 × 300 à e = 220 ; gorge 10 ;
couronne D = 150 ; C30/37 ; N_ELU = 1000 kN ; P_blocage = 600 kN ; qualité Z15.

**Tronçon en T.** f_cd = 30 / 1,5 = 20 ; f_jd = 2/3 × 20 = 13,333 MPa.
c = 30 √(235 / (3 × 13,333)) = 72,715 mm.
g = 110 − 10 − 75 = 25 mm ≤ c : les âmes entrent dans le contour.
Bandes des âmes |y| ≥ 110 − 10 − 72,715 = 27,285 sur toute la platine :
2 × 122,715 × 300 = 73 629,1 mm². Disque R = 147,715 limité à |y| < 27,285 :
2 [y₀ √(R² − y₀²) + R² asin(y₀/R)] = 16 029,4 mm². Perçage : 5 026,6 mm².
**A_eff = 84 631,9 mm²** ; F_c,Rd = 1128,4 kN ; **taux 0,886**.
σ_c = 11,816 MPa.

**Poinçonnement.** τ = 10⁶ / (π × 150 × 30) = 70,736 MPa ;
τ_Rd = 235/√3 = 135,677 ; **taux 0,521**.

**Âmes.** Section en T : b_eff = min(55 ; 450) ; b_int = 55, b_ext = min(55 ; 30) = 30 ;
B_f = 105 ; A = 6150 mm² ; z_G = 58,902 ; I = 18 307 591 mm⁴ ; S_f = 138 293 mm³.
Torsion du raidisseur : h_w/t_w = 7,5 ≤ √(210 000 / (5,3 × 235)) = 12,985 : **taux 0,578**.

**Cordons.** Largeur collectée w_s = 20 + 30 + 12,5 = 62,5 mm.
Pression collectée : σ_c w_s = 0,7385 kN/mm, soit −0,3692 kN/mm par cordon (compression).
Console extérieure : m = 11,816 × 30² / 2 = 5,317 kN (sous 23,5 et 52,9) ;
ΔF = 5,317 / 30 = 0,1772 kN/mm.
Tranchant de la poutre en T : V = 0,7385 × 150 / 2 = 55,39 kN ; v = V S_f / I = 0,4184 kN/mm.
Cordon extérieur : p₁ = −0,5465, p_// = 0,2092 kN/mm →
σ⊥ = τ⊥ = −38,64 MPa, τ_// = 20,92 MPa, équivalente 85,36 MPa, **taux 0,237**.

**Arrachement lamellaire.** a_eff = 10√2 = 14,1 → Z_a = 6 ; multipasse Z_b = 0 ;
t = 30 → Z_c = 6 ; Z_Ed = 12 ≤ Z15 : **taux 0,800**.

**Service.** σ = 600 000 / 84 632 = 7,09 MPa ; flèche de console 0,052 mm ;
taux élastique 3σc²/(t² f_y) = 0,532 = σ / f_jd.

Verdict : **conforme**, mécanisme gouvernant : appui sur le béton.

## VASSE-2 — la même chaise sur une lierne (UPN 220), L = 300

Section nette au droit du perçage : M_Ed = N e / 6 = 36,667 kN·m ;
M_Rd,net = (300 − 80) × 30² × 235 / 4 = 11,633 kN·m : **taux 3,152**, la platine
ne franchit pas l'entraxe.

**Cordons.** l_charge = min(300 ; 150 + 60) = 210 ; suspension F = 500 / 210 = 2,381 kN/mm ;
encastrement parfait m = 27 500 / 210 = 130,95 kN, borné par le moment plastique
de l'âme 20² × 235 / 4 = 23,5 kN : ΔF = 23,5 / 30 = 0,7833 kN/mm.
Cordon intérieur : p₁ = 1,1905 + 0,7833 = 1,9738 kN/mm.
v = 250 × 138 293 / 18 307 591 = 1,8885 kN/mm, p_// = 0,9442 par cordon.
σ⊥ = τ⊥ = 139,57 MPa, τ_// = 94,42 MPa, équivalente 323,52 MPa : **taux 0,899** ;
second critère 139,57 / 259,2 = 0,538.

**Poutre.** M = 0,5 × 1000 × 300 / 4 = 37,5 kN·m ; M_el,Rd = W_chant f_y = 35,527 kN·m ;
V_pl,Rd = 407,03 kN ; V/V_pl = 0,614 > 0,5 → ρ = 0,0522 ; M_V,Rd = 33,674 ; **taux 1,114**.

**Lierne (EN 1993-1-5 §6).** s_s = 20 + 60 = 80 ; F_cr = 4239,4 kN ; m₁ = 8,889 ;
λ_F = 0,314 ≤ 0,5 → m₂ = 0 ; ℓ_y = 179,54 ; λ_F = 0,299 ; χ_F = 1 ;
F_Rd = 379,72 kN pour 250 kN : **taux 0,658**.

**Interaction dans la platine.** σ_x = 120,65 MPa (face support), σ_z = 6 × 23 500 / 900 = 156,67 MPa ;
von Mises 240,84 MPa : **taux 1,025**.

## Bascule du mécanisme gouvernant avec d₀

Même lierne, platine de 50 en S355 (f_y = 335, t > 40), gorge 8, N = 700 kN.
M_Ed = 700 × 220 / 6 = 25,667 kN·m.
d₀ = 80 : M_Rd,net = 220 × 2500 × 335 / 4 = 46,06 → 0,557 ; **la gorge gouverne**.
d₀ = 180 : M_Rd,net = 25,13 → 1,022 ; **la section nette gouverne**.

## Té soudé

Plat 20 × 200 sur platine de 20, cordons de 6 des deux côtés, N = 240 kN.
Gorges rabattues à y = ±13 : A = 2400 mm². p₁ = 0,6 kN/mm ;
σ⊥ = τ⊥ = 70,71 MPa ; équivalente 141,42 ; **taux 0,393**.
Avec M_hors = 2,4 kN·m : couple 2400 / 26 / 200 = 0,4615 kN/mm → **0,695**.
Pénétration partielle a = 6 : σ⊥ = 100 MPa en traction, 100 / 259,2 = **0,386**.

## Recouvrement

Plat 100 × 10 sur plat 120 × 10, L_r = 100, gorge 5, N = 100 kN.
Latéraux seuls : τ_// = 100 MPa, équivalente 173,2 → **0,481** (les deux méthodes coïncident).
Frontal seul : σ⊥ = +141,4 MPa (gorge tendue), τ⊥ = −141,4 → **0,786**.
L_r = 1000 > 150a : β_Lw = 1,2 − 0,2 × 1000 / 750 = 0,933.

## Profilé sur platine

200 × 200, âme 10, semelles 15 ; gorges 7 et 5 ; M_y = 50 kN·m, V_z = 100 kN.
I_zz = 2×1400×103,5² + 4×665×81,5² + 2×5×170³/12 = 51 756 852 mm⁴.
Semelle extérieure : σ = 99,99 MPa → 0,393. Âme en z = 85 : σ = 82,11, τ_// = 58,82 →
équivalente 154,49 : **0,429**, l'âme gouverne.
