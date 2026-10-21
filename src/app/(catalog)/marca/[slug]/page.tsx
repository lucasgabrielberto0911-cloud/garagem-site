import { StockLanding, stockLandingMetadata } from "@/components/site/StockLanding";
export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) { return stockLandingMetadata("marca", (await params).slug); }
export default async function Page({ params }: Props) { return <StockLanding kind="marca" slug={(await params).slug} />; }
