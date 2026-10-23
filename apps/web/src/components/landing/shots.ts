export type GalleryItem = {
  title: string;
  text: string;
  /** The picture, a file under public/landing/gallery. */
  src: string;
  /** A small copy for the row of buttons. */
  thumb: string;
  alt: string;
};

/** What the gallery shows. To add a shot, drop the files into public/landing/gallery and add an item. */
export const GALLERY: GalleryItem[] = [
  {
    title: "Place story",
    text: "The story of the place the map shows, in a panel beside it, with Play and Report.",
    src: "/landing/gallery/place-story-map.webp",
    thumb: "/landing/gallery/place-story-map-thumb.png",
    alt: "The world map open on Go'Shek Farm, with its Place Story panel beside it",
  },
  {
    title: "Zones on the map",
    text: "Every zone and area has its own story and picture. This one is Arathi Highlands.",
    src: "/landing/gallery/map-and-story.webp",
    thumb: "/landing/gallery/map-and-story-thumb.png",
    alt: "The Arathi Highlands map with the Place Story panel showing its picture and lore",
  },
  {
    title: "In a dark look",
    text: "The same panel with a dark look applied: Azeroth's story beside the world map.",
    src: "/landing/gallery/world-map-dark.webp",
    thumb: "/landing/gallery/world-map-dark-thumb.png",
    alt: "The world map with a dark Place Story panel telling the story of Azeroth",
  },
  {
    title: "Place story on parchment",
    text: "The story with its picture on the quest log's parchment. The words being read are marked.",
    src: "/landing/gallery/place-story.webp",
    thumb: "/landing/gallery/place-story-thumb.png",
    alt: "A parchment panel for Teldrassil showing a picture and the first lines of its story",
  },
  {
    title: "Compendium: Places",
    text: "Azeroth's Compendium lists every place by zone and plays any story without going there.",
    src: "/landing/gallery/compendium-places.webp",
    thumb: "/landing/gallery/compendium-places-thumb.png",
    alt: "The Compendium's Places tab showing the story of Shadowglen with its picture",
  },
  {
    title: "Compendium: Quests",
    text: "Every quest with its description and completion text, and a Play button for each.",
    src: "/landing/gallery/compendium-quests.webp",
    thumb: "/landing/gallery/compendium-quests-thumb.png",
    alt: "The Compendium's Quests tab showing the quest Rescue OOX-09/HL with its text",
  },
  {
    title: "Compendium in a dark look",
    text: "The Compendium with a dark look applied, here on the quest Jitters' Growling Gut.",
    src: "/landing/gallery/compendium-quests-dark.webp",
    thumb: "/landing/gallery/compendium-quests-dark-thumb.png",
    alt: "The Compendium in a dark look showing the quest Jitters' Growling Gut",
  },
  {
    title: "Compendium: Readables",
    text: "Books, journals and notes, listed by name. Here, Lorenbrow's Journal.",
    src: "/landing/gallery/compendium-readables.webp",
    thumb: "/landing/gallery/compendium-readables-thumb.png",
    alt: "The Compendium's Readables tab showing Lorenbrow's Journal",
  },
  {
    title: "Books and journals",
    text: "A readable opened in the world. The words being read are marked, with Stop and skip.",
    src: "/landing/gallery/journal-page.webp",
    thumb: "/landing/gallery/journal-page-thumb.png",
    alt: "A Faded Journal Page with its text and playback buttons, one word marked in red",
  },
  {
    title: "Tablets",
    text: "Stone tablets and plaques read like books, in their own frame.",
    src: "/landing/gallery/tablet.webp",
    thumb: "/landing/gallery/tablet-thumb.png",
    alt: "An Ancient Tablet with its text and playback buttons, one word highlighted in gold",
  },
];
