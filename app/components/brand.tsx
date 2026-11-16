import Link from "next/link";
import { Icon } from "./symbols";

export function Brand() {
  return <Link href="/" className="brand" aria-label="AIDeck home"><span className="brand-mark"><Icon name="layers" size={25} /></span><span><strong>AI<span>Deck</span></strong><small>GRANT THORNTON · AI DEPARTMENT</small></span></Link>;
}

