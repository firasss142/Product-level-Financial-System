import { useMemo } from "react";
import { Card, CardContent, Badge, EmptyState, SkeletonCard } from "@/components/ui";
import { fmtPrice, fmtPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProductDetail {
  productId: string;
  productName: string;
  contributionMarginTotal: number;
  contributionMarginPerOrder: number | null;
  deliveredCount: number;
  returnRate: number | null;
  exchangeRate: number | null;
}

interface ProductGridProps {
  productDetails: ProductDetail[];
  loading: boolean;
  accountLabel?: string;
}

export function ProductGrid({ productDetails, loading, accountLabel }: ProductGridProps) {
  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-navy mb-4">Rentabilité par produit</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (productDetails.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-navy mb-4">Rentabilité par produit</h2>
        <EmptyState title="Aucun produit actif" description="Ajoutez des produits pour voir leur rentabilité." />
      </div>
    );
  }

  // Sort worst margin first — memoized to avoid O(n log n) on every render
  const sorted = useMemo(
    () => [...productDetails].sort((a, b) => a.contributionMarginTotal - b.contributionMarginTotal),
    [productDetails]
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-navy mb-4">Rentabilité par produit</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((product) => (
          <Card key={product.productId}>
            <CardContent>
              {accountLabel ? (
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-navy truncate">{product.productName}</p>
                  <Badge variant="default" className="shrink-0 truncate max-w-[120px]">
                    {accountLabel}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm font-semibold text-navy truncate mb-0.5">{product.productName}</p>
              )}
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums mt-2",
                  product.contributionMarginTotal >= 0 ? "text-emerald" : "text-terracotta"
                )}
              >
                {fmtPrice(product.contributionMarginTotal)}{" "}
                <span className="text-sm font-medium text-warm-gray-500">TND</span>
              </p>
              {product.contributionMarginPerOrder !== null && (
                <p className="text-xs text-warm-gray-500 mt-0.5 tabular-nums">
                  {fmtPrice(product.contributionMarginPerOrder)} TND / commande
                </p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-sm text-warm-gray-600">
                  {product.deliveredCount} livrée{product.deliveredCount !== 1 ? "s" : ""}
                </span>
                {product.returnRate !== null && (
                  <Badge variant="returned">
                    {fmtPercent(product.returnRate)}% retour
                  </Badge>
                )}
                {product.exchangeRate !== null && product.exchangeRate > 0 && (
                  <Badge variant={product.exchangeRate > 0.1 ? "pending" : "default"}>
                    {fmtPercent(product.exchangeRate)}% échange
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
