type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type PieceColor = "w" | "b";

type ChessPieceSvgProps = {
  color: PieceColor;
  type: PieceType;
};

const pieceCodeByType: Record<PieceType, string> = {
  p: "P",
  n: "N",
  b: "B",
  r: "R",
  q: "Q",
  k: "K"
};

export function ChessPieceSvg({ color, type }: ChessPieceSvgProps) {
  const pieceCode = pieceCodeByType[type];
  const src = `/pieces/cburnett/${color}${pieceCode}.svg`;

  return <img alt="" aria-hidden="true" className="piece-svg" draggable={false} src={src} />;
}
