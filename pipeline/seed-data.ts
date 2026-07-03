// Hand-curated seed list: the editorial selection of periods, artists, and
// must-include iconic paintings. All *content* (bios, dates, images, stories)
// is fetched from Wikipedia/Wikidata/Commons by the pipeline — this file only
// names what to fetch.
//
// `wiki` fields are exact English Wikipedia article titles.
// `mustInclude` are painting titles matched fuzzily against Wikidata labels —
// they are preferences, not hard requirements (validation reports misses).
// `copyrighted: true` marks artists whose paintings are expected to have no
// free image on Commons → placeholder canvases (full metadata, no image).

export interface SeedPeriod {
  slug: string;
  name: string;
  wiki: string; // Wikipedia article for the period summary
  startYear: number;
  endYear: number;
  accent: string; // UI accent color (design choice, not data)
}

export interface SeedArtist {
  wiki: string;
  period: string; // period slug
  copyrighted?: boolean;
  mustInclude: string[];
  // Editorial overrides for when Wikidata's work-period claims (P2031/P2032)
  // are wrong at the source. Applied after fetching, so they survive re-runs.
  activeFrom?: number;
  activeTo?: number;
}

export const PERIODS: SeedPeriod[] = [
  { slug: "medieval-gothic", name: "Medieval & Gothic", wiki: "Gothic art", startYear: 1150, endYear: 1400, accent: "#8a6d3b" },
  { slug: "early-renaissance", name: "Early Renaissance", wiki: "Italian Renaissance painting", startYear: 1400, endYear: 1495, accent: "#9c6644" },
  { slug: "northern-renaissance", name: "Northern Renaissance", wiki: "Northern Renaissance", startYear: 1420, endYear: 1570, accent: "#5e503f" },
  { slug: "high-renaissance", name: "High Renaissance", wiki: "High Renaissance", startYear: 1490, endYear: 1530, accent: "#7f5539" },
  { slug: "mannerism", name: "Mannerism", wiki: "Mannerism", startYear: 1520, endYear: 1600, accent: "#6b705c" },
  { slug: "baroque", name: "Baroque", wiki: "Baroque painting", startYear: 1600, endYear: 1730, accent: "#582f0e" },
  { slug: "rococo", name: "Rococo", wiki: "Rococo", startYear: 1715, endYear: 1780, accent: "#b08968" },
  { slug: "neoclassicism", name: "Neoclassicism", wiki: "Neoclassicism", startYear: 1760, endYear: 1830, accent: "#4a5759" },
  { slug: "romanticism", name: "Romanticism", wiki: "Romanticism", startYear: 1780, endYear: 1850, accent: "#735d78" },
  { slug: "realism", name: "Realism", wiki: "Realism (art movement)", startYear: 1840, endYear: 1880, accent: "#6c584c" },
  { slug: "impressionism", name: "Impressionism", wiki: "Impressionism", startYear: 1860, endYear: 1895, accent: "#7209b7" },
  { slug: "post-impressionism", name: "Post-Impressionism", wiki: "Post-Impressionism", startYear: 1885, endYear: 1910, accent: "#f3722c" },
  { slug: "symbolism-art-nouveau", name: "Symbolism & Art Nouveau", wiki: "Symbolism (arts)", startYear: 1880, endYear: 1915, accent: "#bc6c25" },
  { slug: "expressionism", name: "Expressionism", wiki: "Expressionism", startYear: 1905, endYear: 1935, accent: "#9d0208" },
  { slug: "cubism-abstraction", name: "Cubism & Early Abstraction", wiki: "Cubism", startYear: 1907, endYear: 1940, accent: "#3a5a40" },
  { slug: "surrealism", name: "Surrealism", wiki: "Surrealism", startYear: 1920, endYear: 1955, accent: "#3d348b" },
  { slug: "abstract-expressionism", name: "Abstract Expressionism", wiki: "Abstract expressionism", startYear: 1943, endYear: 1965, accent: "#bb3e03" },
  { slug: "pop-art", name: "Pop Art", wiki: "Pop art", startYear: 1955, endYear: 1975, accent: "#ef476f" },
  { slug: "contemporary", name: "Contemporary", wiki: "Contemporary art", startYear: 1970, endYear: 2026, accent: "#118ab2" },
];

export const ARTISTS: SeedArtist[] = [
  // ——— Medieval & Gothic ———
  { wiki: "Giotto", period: "medieval-gothic", mustInclude: ["Ognissanti Madonna", "Kiss of Judas", "Lamentation"] },
  { wiki: "Duccio", period: "medieval-gothic", mustInclude: ["Maestà", "Rucellai Madonna"] },
  { wiki: "Cimabue", period: "medieval-gothic", mustInclude: ["Santa Trinita Maestà", "Crucifix"] },
  { wiki: "Simone Martini", period: "medieval-gothic", mustInclude: ["Annunciation", "Maestà"] },

  // ——— Early Renaissance ———
  { wiki: "Masaccio", period: "early-renaissance", mustInclude: ["The Tribute Money", "Holy Trinity", "Expulsion from the Garden of Eden"] },
  { wiki: "Fra Angelico", period: "early-renaissance", mustInclude: ["Annunciation", "Coronation of the Virgin"] },
  { wiki: "Sandro Botticelli", period: "early-renaissance", mustInclude: ["The Birth of Venus", "Primavera", "Adoration of the Magi"] },
  { wiki: "Piero della Francesca", period: "early-renaissance", mustInclude: ["The Baptism of Christ", "The Flagellation of Christ", "Resurrection"] },

  // ——— Northern Renaissance ———
  { wiki: "Jan van Eyck", period: "northern-renaissance", mustInclude: ["Arnolfini Portrait", "Ghent Altarpiece", "Portrait of a Man in a Red Turban"] },
  { wiki: "Albrecht Dürer", period: "northern-renaissance", mustInclude: ["Self-Portrait", "Adoration of the Magi", "Four Apostles"] },
  { wiki: "Hieronymus Bosch", period: "northern-renaissance", mustInclude: ["The Garden of Earthly Delights", "The Haywain Triptych", "The Temptation of St Anthony"] },
  { wiki: "Pieter Bruegel the Elder", period: "northern-renaissance", mustInclude: ["The Tower of Babel", "Hunters in the Snow", "Netherlandish Proverbs", "The Peasant Wedding"] },
  { wiki: "Hans Holbein the Younger", period: "northern-renaissance", mustInclude: ["The Ambassadors", "Portrait of Henry VIII", "Darmstadt Madonna"] },

  // ——— High Renaissance ———
  // activeFrom: Wikidata Q762 claims work period 1519–1519 (bad import);
  // the Wikipedia infobox has "c. 1470–1519".
  { wiki: "Leonardo da Vinci", period: "high-renaissance", activeFrom: 1470, mustInclude: ["Mona Lisa", "The Last Supper", "Lady with an Ermine", "Ginevra de' Benci"] },
  { wiki: "Michelangelo", period: "high-renaissance", mustInclude: ["The Creation of Adam", "The Last Judgment", "Doni Tondo"] },
  { wiki: "Raphael", period: "high-renaissance", mustInclude: ["The School of Athens", "Sistine Madonna", "Transfiguration"] },
  { wiki: "Titian", period: "high-renaissance", mustInclude: ["Venus of Urbino", "Bacchus and Ariadne", "Assumption of the Virgin"] },

  // ——— Mannerism ———
  { wiki: "El Greco", period: "mannerism", mustInclude: ["The Burial of the Count of Orgaz", "View of Toledo", "The Disrobing of Christ"] },
  { wiki: "Bronzino", period: "mannerism", mustInclude: ["Venus, Cupid, Folly and Time", "Portrait of Eleanor of Toledo"] },
  { wiki: "Parmigianino", period: "mannerism", mustInclude: ["Madonna with the Long Neck", "Self-portrait in a Convex Mirror"] },
  { wiki: "Tintoretto", period: "mannerism", mustInclude: ["The Last Supper", "Paradise"] },
  { wiki: "Paolo Veronese", period: "mannerism", mustInclude: ["The Wedding at Cana", "The Feast in the House of Levi"] },

  // ——— Baroque ———
  { wiki: "Caravaggio", period: "baroque", mustInclude: ["The Calling of Saint Matthew", "Judith Beheading Holofernes", "David with the Head of Goliath", "The Entombment of Christ"] },
  { wiki: "Rembrandt", period: "baroque", mustInclude: ["The Night Watch", "The Anatomy Lesson of Dr Nicolaes Tulp", "The Storm on the Sea of Galilee", "Self-Portrait with Two Circles"] },
  { wiki: "Peter Paul Rubens", period: "baroque", mustInclude: ["The Descent from the Cross", "The Garden of Love", "Massacre of the Innocents"] },
  { wiki: "Johannes Vermeer", period: "baroque", mustInclude: ["Girl with a Pearl Earring", "The Milkmaid", "View of Delft", "The Art of Painting"] },
  { wiki: "Diego Velázquez", period: "baroque", mustInclude: ["Las Meninas", "The Surrender of Breda", "Portrait of Innocent X", "The Rokeby Venus"] },
  { wiki: "Artemisia Gentileschi", period: "baroque", mustInclude: ["Judith Slaying Holofernes", "Self-Portrait as the Allegory of Painting"] },

  // ——— Rococo ———
  { wiki: "Antoine Watteau", period: "rococo", mustInclude: ["The Embarkation for Cythera", "Pierrot"] },
  { wiki: "François Boucher", period: "rococo", mustInclude: ["Madame de Pompadour", "The Toilette of Venus"] },
  { wiki: "Jean-Honoré Fragonard", period: "rococo", mustInclude: ["The Swing", "A Young Girl Reading", "The Bolt"] },
  { wiki: "Giovanni Battista Tiepolo", period: "rococo", mustInclude: ["The Banquet of Cleopatra", "Allegory of the Planets and Continents"] },

  // ——— Neoclassicism ———
  { wiki: "Jacques-Louis David", period: "neoclassicism", mustInclude: ["The Death of Marat", "Oath of the Horatii", "Napoleon Crossing the Alps", "The Coronation of Napoleon"] },
  { wiki: "Jean-Auguste-Dominique Ingres", period: "neoclassicism", mustInclude: ["Grande Odalisque", "Portrait of Monsieur Bertin", "The Turkish Bath"] },
  { wiki: "Angelica Kauffman", period: "neoclassicism", mustInclude: ["Cornelia, Mother of the Gracchi"] },
  { wiki: "Élisabeth Vigée Le Brun", period: "neoclassicism", mustInclude: ["Marie Antoinette with a Rose", "Self-portrait in a Straw Hat"] },

  // ——— Romanticism ———
  { wiki: "Francisco Goya", period: "romanticism", mustInclude: ["The Third of May 1808", "Saturn Devouring His Son", "La maja desnuda", "Witches' Sabbath"] },
  { wiki: "Caspar David Friedrich", period: "romanticism", mustInclude: ["Wanderer above the Sea of Fog", "The Sea of Ice", "Abbey in the Oakwood"] },
  { wiki: "J. M. W. Turner", period: "romanticism", mustInclude: ["The Fighting Temeraire", "Rain, Steam and Speed", "The Slave Ship"] },
  { wiki: "Eugène Delacroix", period: "romanticism", mustInclude: ["Liberty Leading the People", "The Death of Sardanapalus", "The Barque of Dante"] },
  { wiki: "Théodore Géricault", period: "romanticism", mustInclude: ["The Raft of the Medusa", "The Charging Chasseur"] },

  // ——— Realism ———
  { wiki: "Gustave Courbet", period: "realism", mustInclude: ["A Burial at Ornans", "The Stone Breakers", "The Desperate Man", "The Artist's Studio"] },
  { wiki: "Jean-François Millet", period: "realism", mustInclude: ["The Gleaners", "The Angelus", "The Sower"] },
  { wiki: "Rosa Bonheur", period: "realism", mustInclude: ["The Horse Fair", "Ploughing in the Nivernais"] },
  { wiki: "Ilya Repin", period: "realism", mustInclude: ["Barge Haulers on the Volga", "Ivan the Terrible and His Son Ivan", "Reply of the Zaporozhian Cossacks"] },

  // ——— Impressionism ———
  { wiki: "Édouard Manet", period: "impressionism", mustInclude: ["Olympia", "The Luncheon on the Grass", "A Bar at the Folies-Bergère"] },
  { wiki: "Claude Monet", period: "impressionism", mustInclude: ["Impression, Sunrise", "Woman with a Parasol - Madame Monet and Her Son", "Water Lilies"] },
  { wiki: "Pierre-Auguste Renoir", period: "impressionism", mustInclude: ["Dance at Le Moulin de la Galette", "Luncheon of the Boating Party", "Dance at Bougival"] },
  { wiki: "Edgar Degas", period: "impressionism", mustInclude: ["The Ballet Class", "L'Absinthe", "The Dance Class"] },
  { wiki: "Berthe Morisot", period: "impressionism", mustInclude: ["The Cradle", "Summer's Day"] },
  { wiki: "Camille Pissarro", period: "impressionism", mustInclude: ["The Boulevard Montmartre at Night"] },
  { wiki: "Mary Cassatt", period: "impressionism", mustInclude: ["The Child's Bath", "The Boating Party", "Little Girl in a Blue Armchair"] },

  // ——— Post-Impressionism ———
  { wiki: "Vincent van Gogh", period: "post-impressionism", mustInclude: ["The Starry Night", "Sunflowers", "Self-Portrait with Bandaged Ear", "The Potato Eaters", "Wheatfield with Crows", "Bedroom in Arles"] },
  { wiki: "Paul Cézanne", period: "post-impressionism", mustInclude: ["The Card Players", "Mont Sainte-Victoire", "The Bathers", "Still Life with Apples"] },
  { wiki: "Paul Gauguin", period: "post-impressionism", mustInclude: ["Where Do We Come From? What Are We? Where Are We Going?", "The Yellow Christ", "Vision After the Sermon"] },
  { wiki: "Georges Seurat", period: "post-impressionism", mustInclude: ["A Sunday Afternoon on the Island of La Grande Jatte", "Bathers at Asnières", "The Circus"] },
  { wiki: "Henri de Toulouse-Lautrec", period: "post-impressionism", mustInclude: ["At the Moulin Rouge", "In Bed"] },
  { wiki: "Henri Rousseau", period: "post-impressionism", mustInclude: ["The Sleeping Gypsy", "Tiger in a Tropical Storm", "The Dream"] },

  // ——— Symbolism & Art Nouveau ———
  { wiki: "Gustav Klimt", period: "symbolism-art-nouveau", mustInclude: ["The Kiss", "Portrait of Adele Bloch-Bauer I", "Judith and the Head of Holofernes", "Death and Life"] },
  // "The Slav Epic" itself is a painting *series* on Wikidata (excluded by the
  // P31 painting filter), so it can never match — name individual canvases.
  { wiki: "Alphonse Mucha", period: "symbolism-art-nouveau", mustInclude: ["Slavs in their Original Homeland", "The Celebration of Svantovit"] },
  { wiki: "Odilon Redon", period: "symbolism-art-nouveau", mustInclude: ["The Cyclops"] },
  { wiki: "Arnold Böcklin", period: "symbolism-art-nouveau", mustInclude: ["Isle of the Dead", "Self-Portrait with Death Playing the Fiddle"] },

  // ——— Expressionism ———
  { wiki: "Edvard Munch", period: "expressionism", mustInclude: ["The Scream", "Madonna", "The Sick Child", "The Dance of Life"] },
  { wiki: "Wassily Kandinsky", period: "expressionism", mustInclude: ["Composition VII", "Composition VIII", "Der Blaue Reiter"] },
  { wiki: "Egon Schiele", period: "expressionism", mustInclude: ["Self-Portrait with Physalis", "Death and the Maiden", "The Embrace"] },
  { wiki: "Franz Marc", period: "expressionism", mustInclude: ["Blue Horse I", "The Tower of Blue Horses", "Fate of the Animals", "Yellow Cow"] },
  { wiki: "Ernst Ludwig Kirchner", period: "expressionism", mustInclude: ["Street, Berlin", "Self-Portrait as a Soldier", "Marzella"] },
  { wiki: "Paul Klee", period: "expressionism", mustInclude: ["Twittering Machine", "Castle and Sun", "Senecio", "Fish Magic"] },
  { wiki: "Amedeo Modigliani", period: "expressionism", mustInclude: ["Reclining Nude", "Jeanne Hébuterne"] },

  // ——— Cubism & Early Abstraction ———
  { wiki: "Pablo Picasso", period: "cubism-abstraction", copyrighted: true, mustInclude: ["Guernica", "Les Demoiselles d'Avignon", "The Old Guitarist", "Girl before a Mirror", "The Weeping Woman"] },
  { wiki: "Georges Braque", period: "cubism-abstraction", copyrighted: true, mustInclude: ["Violin and Candlestick", "Houses at l'Estaque"] },
  { wiki: "Juan Gris", period: "cubism-abstraction", mustInclude: ["Portrait of Picasso", "Still Life with Checked Tablecloth", "The Sunblind"] },
  { wiki: "Robert Delaunay", period: "cubism-abstraction", mustInclude: ["Simultaneous Windows on the City", "Red Eiffel Tower"] },
  { wiki: "Piet Mondrian", period: "cubism-abstraction", mustInclude: ["Broadway Boogie Woogie", "Composition with Red Blue and Yellow", "Victory Boogie Woogie", "The Gray Tree"] },
  { wiki: "Kazimir Malevich", period: "cubism-abstraction", mustInclude: ["Black Square", "White on White", "Suprematist Composition"] },

  // ——— Surrealism ———
  { wiki: "Salvador Dalí", period: "surrealism", copyrighted: true, mustInclude: ["The Persistence of Memory", "Swans Reflecting Elephants", "The Elephants", "Christ of Saint John of the Cross", "Galatea of the Spheres"] },
  { wiki: "René Magritte", period: "surrealism", copyrighted: true, mustInclude: ["The Treachery of Images", "The Son of Man", "Golconda", "The Lovers"] },
  { wiki: "Joan Miró", period: "surrealism", copyrighted: true, mustInclude: ["The Tilled Field", "Harlequin's Carnival", "The Farm"] },
  { wiki: "Max Ernst", period: "surrealism", copyrighted: true, mustInclude: ["The Elephant Celebes", "Europe After the Rain II", "The Robing of the Bride"] },
  { wiki: "Frida Kahlo", period: "surrealism", copyrighted: true, mustInclude: ["The Two Fridas", "Self-Portrait with Thorn Necklace and Hummingbird", "The Broken Column"] },
  { wiki: "Giorgio de Chirico", period: "surrealism", copyrighted: true, mustInclude: ["The Song of Love", "Mystery and Melancholy of a Street"] },

  // ——— Abstract Expressionism ———
  { wiki: "Jackson Pollock", period: "abstract-expressionism", copyrighted: true, mustInclude: ["No. 5, 1948", "Autumn Rhythm (Number 30)", "Blue Poles", "Convergence", "Mural"] },
  { wiki: "Mark Rothko", period: "abstract-expressionism", copyrighted: true, mustInclude: ["No. 61 (Rust and Blue)", "Orange, Red, Yellow", "Black on Maroon", "White Center"] },
  { wiki: "Willem de Kooning", period: "abstract-expressionism", copyrighted: true, mustInclude: ["Woman I", "Woman III", "Excavation", "Interchange"] },
  { wiki: "Barnett Newman", period: "abstract-expressionism", copyrighted: true, mustInclude: ["Vir Heroicus Sublimis", "Voice of Fire"] },
  { wiki: "Joan Mitchell", period: "abstract-expressionism", copyrighted: true, mustInclude: ["City Landscape"] },

  // ——— Pop Art ———
  { wiki: "Andy Warhol", period: "pop-art", copyrighted: true, mustInclude: ["Campbell's Soup Cans", "Marilyn Diptych", "Shot Marilyns", "Eight Elvises"] },
  { wiki: "Roy Lichtenstein", period: "pop-art", copyrighted: true, mustInclude: ["Whaam!", "Drowning Girl", "Look Mickey", "Crying Girl"] },
  { wiki: "Jasper Johns", period: "pop-art", copyrighted: true, mustInclude: ["Flag", "Three Flags", "Map", "False Start"] },
  { wiki: "David Hockney", period: "pop-art", copyrighted: true, mustInclude: ["A Bigger Splash", "Portrait of an Artist (Pool with Two Figures)"] },

  // ——— Contemporary ———
  { wiki: "Jean-Michel Basquiat", period: "contemporary", copyrighted: true, mustInclude: ["Untitled (Skull)", "Hollywood Africans", "Irony of Negro Policeman"] },
  { wiki: "Gerhard Richter", period: "contemporary", copyrighted: true, mustInclude: ["Betty", "Abstraktes Bild", "Reader"] },
  { wiki: "Yayoi Kusama", period: "contemporary", copyrighted: true, mustInclude: ["Infinity Nets"] },
  { wiki: "Anselm Kiefer", period: "contemporary", copyrighted: true, mustInclude: ["Margarethe", "Interior"] },
  { wiki: "Banksy", period: "contemporary", copyrighted: true, mustInclude: ["Girl with Balloon", "Love is in the Bin"] },
];

// Target counts per artist museum.
export const PAINTINGS_TARGET = 12; // fetch a few extra against failures
export const PAINTINGS_MIN = 8;
