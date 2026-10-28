// Catégories et peptides de l'atlas, dans l'ordre de la liste AURAPEPT.
// Chaque peptide :
//   id     : identifiant court, sans espace (sert aussi d'ancre : #bpc-157)
//   nom    : nom affiché ; alias : autres noms pour la recherche
//   cat    : catégorie (voir CATEGORIES)
//   action : sur quoi il agit, en une phrase simple
//   but    : son but, en une phrase simple
//   zones  : zones du corps à allumer (voir ZONES dans body.js)
//   source : { label, url } vers une source vérifiable
//   mix    : pour un mélange, les peptides qu'il contient (ids)

export const CATEGORIES = [
  { id: "graisse", label: "GLP-1 · Perte de graisse" },
  { id: "peau", label: "Beauté · Peau" },
  { id: "libido", label: "Libido" },
  { id: "performance", label: "Performance · Hormone de croissance" },
  { id: "regeneration", label: "Régénération · Réparation" },
  { id: "cerveau", label: "Nootropiques" },
  { id: "longevite", label: "Longévité · Anti-âge" },
];

export const PEPTIDES = [
  {
    id: "retatrutide", nom: "Retatrutide", alias: ["LY3437943"], cat: "graisse",
    action: "Trois hormones de la digestion (GLP-1, GIP et glucagon), au niveau du cerveau, du pancréas, de l'estomac et du foie.",
    but: "Réduire l'appétit et faire perdre de la graisse, y compris celle du foie.",
    zones: ["graisse", "cerveau", "foie", "pancreas", "estomac"],
    source: { label: "Jastreboff et al., NEJM, 2023", url: "https://doi.org/10.1056/NEJMoa2301972" },
  },
  {
    id: "tesamorelin", nom: "Tesamorelin", alias: ["Egrifta"], cat: "graisse",
    action: "L'hypophyse, la glande qui produit l'hormone de croissance.",
    but: "Réduire la graisse profonde du ventre.",
    zones: ["hypophyse", "graisse"],
    source: { label: "Autorisation FDA d'Egrifta (2010)", url: "https://www.fiercebiotech.com/biotech/fda-approves-egrifta%E2%84%A2-tesamorelin-for-injection-first-and-only-treatment-for-reduction-of" },
  },
  {
    id: "cagrilintide", nom: "Cagrilintide", alias: ["CagriSema"], cat: "graisse",
    action: "Le cerveau et l'estomac, en imitant l'amyline, une hormone du pancréas.",
    but: "Se sentir rassasié plus vite pour manger moins et perdre du poids.",
    zones: ["cerveau", "estomac", "graisse"],
    source: { label: "Historique FDA de CagriSema", url: "https://www.drugs.com/history/cagrisema.html" },
  },
  {
    id: "ghk-cu", nom: "GHK-Cu", alias: ["Peptide de cuivre", "Copper peptide"], cat: "peau",
    action: "Les cellules de la peau, grâce au cuivre qu'il transporte.",
    but: "Relancer la production de collagène pour une peau plus ferme et mieux réparée.",
    zones: ["peau"],
    source: { label: "Pickart et Margolina, revue 2018", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6073405/" },
  },
  {
    id: "glow-stack", nom: "GLOW Stack", alias: ["Glow", "Glow blend"], cat: "peau", mix: ["ghk-cu", "bpc-157", "tb-500"],
    action: "La peau et les tissus à réparer : c'est un mélange de GHK-Cu, BPC-157 et TB-500.",
    but: "Réunir leurs effets pour une peau plus ferme et une réparation plus rapide.",
    zones: ["peau", "articulations", "muscles"],
    source: { label: "Superpower, guide sur les mélanges GLOW et KLOW", url: "https://superpower.com/guides/peptide-science/glow-peptide" },
  },
  {
    id: "glutathion", nom: "Glutathion", alias: ["Glutathione", "GSH"], cat: "peau",
    action: "Les cellules du foie et de la peau : c'est l'antioxydant naturel du corps.",
    but: "Protéger les cellules et éclaircir le teint.",
    zones: ["foie", "peau"],
    source: { label: "Mise en garde de la FDA sur les injections éclaircissantes", url: "https://www.medestheticsmag.com/fda-warns-against-skin-lightening-injectables" },
  },
  {
    id: "melanotan-2", nom: "Melanotan 2", alias: ["Melanotan II", "MT-II", "MT2"], cat: "peau",
    action: "La peau et le cerveau, en imitant l'hormone du bronzage (α-MSH).",
    but: "Bronzer sans soleil ; il augmente aussi la libido.",
    zones: ["peau", "cerveau", "reproduction"],
    source: { label: "Dorr et al., Life Sciences, 1996", url: "https://experts.arizona.edu/en/publications/evaluation-of-melanotan-ii-a-superpotent-cyclic-melanotropic-pept/" },
  },
  {
    id: "melanotan-1", nom: "Melanotan 1", alias: ["Afamélanotide", "Afamelanotide", "Scenesse", "MT-I"], cat: "peau",
    action: "La peau, en imitant l'hormone du bronzage de façon plus ciblée.",
    but: "Foncer la peau pour mieux la protéger du soleil.",
    zones: ["peau"],
    source: { label: "Agence européenne du médicament (EMA)", url: "https://www.ema.europa.eu/en/news/scenesse-recommended-rare-disease-causes-intolerance-sunlight" },
  },
  {
    id: "ahk-cu", nom: "AHK-Cu", alias: ["Peptide de cuivre cheveux"], cat: "peau",
    action: "Les follicules des cheveux, grâce au cuivre qu'il transporte.",
    but: "Stimuler la pousse et la densité des cheveux.",
    zones: ["peau"],
    source: { label: "Pyo et al., 2007", url: "https://agris.fao.org/search/fr/records/65de423b63b8185d9ca7d5b9" },
  },
  {
    id: "pt-141", nom: "PT-141", alias: ["Brémélanotide", "Bremelanotide", "Vyleesi"], cat: "libido",
    action: "Le cerveau, sur les récepteurs qui règlent le désir (mélanocortine).",
    but: "Augmenter le désir et l'excitation sexuelle.",
    zones: ["cerveau", "reproduction"],
    source: { label: "Autorisation FDA de Vyleesi (2019)", url: "https://www.biospace.com/fda-approves-new-treatment-for-hypoactive-sexual-desire-disorder-in-premenopausal-women" },
  },
  {
    id: "ipamorelin", nom: "Ipamorelin", cat: "performance",
    action: "L'hypophyse, en imitant la ghréline.",
    but: "Faire libérer plus d'hormone de croissance, pour les muscles et la récupération.",
    zones: ["hypophyse", "muscles"],
    source: { label: "Ipamorelin (Wikipédia, avec les études citées)", url: "https://en.wikipedia.org/wiki/Ipamorelin" },
  },
  {
    id: "mots-c", nom: "MOTS-c", cat: "performance",
    action: "Les muscles : c'est un peptide fabriqué par les mitochondries, les centrales énergétiques des cellules.",
    but: "Mieux utiliser le sucre et l'énergie, et limiter la prise de graisse.",
    zones: ["muscles", "graisse"],
    source: { label: "Lee et al., Cell Metabolism, 2015", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4350682/" },
  },
  {
    id: "slu-pp-332", nom: "SLU-PP-332", cat: "performance",
    action: "Les muscles, en activant les gènes de l'effort d'endurance.",
    but: "Reproduire certains effets du sport : plus d'endurance et moins de graisse.",
    zones: ["muscles", "graisse"],
    source: { label: "J Pharmacol Exp Ther, 2024", url: "https://profiles.wustl.edu/en/publications/a-synthetic-err-agonist-alleviates-metabolic-syndrome/" },
  },
  {
    id: "bpc-157", nom: "BPC-157", alias: ["Body Protection Compound"], cat: "regeneration",
    action: "L'estomac, l'intestin, les tendons et les muscles.",
    but: "Accélérer la réparation des tissus abîmés.",
    zones: ["estomac", "intestins", "articulations", "muscles"],
    source: { label: "Pharmacy Times, 2026", url: "https://pharmacytimes.com/view/heal-or-harm-body-protective-compound-157-in-the-gray-zone" },
  },
  {
    id: "tb-500", nom: "TB-500", alias: ["Thymosine bêta-4", "Thymosin beta-4", "TB4"], cat: "regeneration",
    action: "Les zones blessées, en guidant les cellules réparatrices (c'est une version courte de la thymosine bêta-4).",
    but: "Accélérer la cicatrisation et la récupération des muscles, des tendons et des articulations.",
    zones: ["articulations", "muscles", "coeur", "peau"],
    source: { label: "McGuire et al., revue 2026", url: "https://doi.org/10.3390/app16126202" },
  },
  {
    id: "wolverine-stack", nom: "Wolverine Stack", alias: ["Wolverine"], cat: "regeneration", mix: ["bpc-157", "tb-500"],
    action: "Les tendons, les muscles et les articulations : c'est un mélange de BPC-157 et TB-500.",
    but: "Accélérer la récupération et la réparation après une blessure.",
    zones: ["articulations", "muscles"],
    source: { label: "Magellan Rx, composition du Wolverine Stack", url: "https://www1.magellanrx.com/wolverine-stack-peptide/" },
  },
  {
    id: "kpv", nom: "KPV", alias: ["Lys-Pro-Val"], cat: "regeneration",
    action: "L'intestin et la peau ; c'est un petit fragment de l'hormone α-MSH.",
    but: "Calmer l'inflammation.",
    zones: ["intestins"],
    source: { label: "Dalmasso et al., 2008", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2431115/" },
  },
  {
    id: "semax", nom: "Semax", cat: "cerveau",
    action: "Le cerveau, en augmentant le BDNF, une protéine qui protège les neurones.",
    but: "Améliorer la concentration et la mémoire, et protéger le cerveau.",
    zones: ["cerveau"],
    source: { label: "Alzheimer's Drug Discovery Foundation", url: "https://www.alzdiscovery.org/uploads/cognitive_vitality_media/Semax-Cognitive-Vitality-For-Researchers.pdf" },
  },
  {
    id: "dsip", nom: "DSIP", alias: ["Delta Sleep-Inducing Peptide", "Peptide du sommeil delta"], cat: "cerveau",
    action: "Le cerveau, dans les zones qui règlent le sommeil.",
    but: "Favoriser un sommeil profond.",
    zones: ["cerveau"],
    source: { label: "Revue scientifique, 1984", url: "https://pubmed.ncbi.nlm.nih.gov/6145137/" },
  },
  {
    id: "selank", nom: "Selank", cat: "cerveau",
    action: "Le cerveau, sur les circuits du stress.",
    but: "Réduire l'anxiété et le stress.",
    zones: ["cerveau"],
    source: { label: "Étude russe sur le Selank, 2008", url: "https://pubmed.ncbi.nlm.nih.gov/18577961/" },
  },
  {
    id: "epithalon", nom: "Epithalon", alias: ["Epitalon", "AEDG"], cat: "longevite",
    action: "Les cellules, via la télomérase, une enzyme liée au vieillissement ; il est inspiré d'une substance de la glande pinéale, au centre du cerveau.",
    but: "Ralentir le vieillissement des cellules.",
    zones: ["cerveau", "corps-entier"],
    source: { label: "Khavinson et al., 2003", url: "https://doi.org/10.1023/A:1025493705728" },
  },
  {
    id: "nad", nom: "NAD+", alias: ["NAD", "Nicotinamide adénine dinucléotide"], cat: "longevite",
    action: "Toutes les cellules : c'est une molécule indispensable à la production d'énergie.",
    but: "Soutenir l'énergie des cellules et lutter contre le vieillissement.",
    zones: ["corps-entier"],
    source: { label: "Revue scientifique, 2023", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10692436/" },
  },
  {
    id: "klow-stack", nom: "KLOW Stack", alias: ["Klow", "Klow blend"], cat: "longevite", mix: ["ghk-cu", "bpc-157", "tb-500", "kpv"],
    action: "La peau, l'intestin et les tissus à réparer : c'est un mélange de GHK-Cu, BPC-157, TB-500 et KPV.",
    but: "Réunir la réparation de la peau et des tissus avec l'effet anti-inflammatoire du KPV.",
    zones: ["peau", "intestins", "articulations", "muscles"],
    source: { label: "Superpower, guide sur les mélanges GLOW et KLOW", url: "https://superpower.com/guides/peptide-science/glow-peptide" },
  },
];
