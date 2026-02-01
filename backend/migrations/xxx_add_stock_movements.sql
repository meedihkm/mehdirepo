-- Migration: Création de la table stock_movements
-- Date: 2026-02-01
-- Description: Table pour tracer les mouvements de stock (entrées, sorties, ajustements)

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  product_id UUID NOT NULL REFERENCES products(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'initial')),
  quantity DECIMAL(10,2) NOT NULL,
  previous_stock DECIMAL(10,2) NOT NULL,
  new_stock DECIMAL(10,2) NOT NULL,
  order_id UUID REFERENCES orders(id),
  delivery_id UUID REFERENCES deliveries(id),
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index pour les recherches fréquentes
CREATE INDEX stock_movements_product_idx ON stock_movements(product_id);
CREATE INDEX stock_movements_org_idx ON stock_movements(organization_id);
CREATE INDEX stock_movements_type_idx ON stock_movements(type);
CREATE INDEX stock_movements_date_idx ON stock_movements(created_at);

-- Commentaires sur la table et les colonnes
COMMENT ON TABLE stock_movements IS 'Historique des mouvements de stock';
COMMENT ON COLUMN stock_movements.type IS 'Type de mouvement: in (entrée), out (sortie), adjustment (ajustement), initial (stock initial)';
COMMENT ON COLUMN stock_movements.quantity IS 'Quantité du mouvement (toujours positive)';
COMMENT ON COLUMN stock_movements.previous_stock IS 'Stock avant le mouvement';
COMMENT ON COLUMN stock_movements.new_stock IS 'Stock après le mouvement';
COMMENT ON COLUMN stock_movements.order_id IS 'Référence à la commande si le mouvement est lié à une commande';
COMMENT ON COLUMN stock_movements.delivery_id IS 'Référence à la livraison si le mouvement est lié à une livraison';
