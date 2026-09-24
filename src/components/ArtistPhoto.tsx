import hero from "../assets/artist.jpg";

export default function ArtistPhoto({ size = 96 }: { size?: number }) {
  return (
    <span
      className="inline-block overflow-hidden rounded-full border-2 border-[#c75b24] bg-[#221a16] mx-auto"
      style={{ width: size, height: size }}
    >
      <img src={hero} alt="TRIAGED" className="h-full w-full object-cover" />
    </span>
  );
}
