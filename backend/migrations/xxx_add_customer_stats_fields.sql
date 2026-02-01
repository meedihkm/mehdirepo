-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Ajout des champs de statistiques à la table customers
-- Date: 2026-02-01
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ajouter les champs de statistiques dénormalisées
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(12,2) DEFAULT 0;

-- Créer des index pour les performances
CREATE INDEX IF NOT EXISTS customers_last_payment_idx ON customers(last_payment_at);
CREATE INDEX IF NOT EXISTS customers_last_order_idx ON customers(last_order_at);
CREATE INDEX IF NOT EXISTS customers_total_orders_idx ON customers(total_orders);

-- Mettre à jour les champs dénormalisés à partir des données existantes (optionnel)
-- Cette partie peut être exécutée si vous avez déjà des données

-- Mettre à jour total_orders et total_revenue à partir des commandes existantes
UPDATE customers c
SET 
  total_orders = COALESCE(o.order_count, 0),
  total_revenue = COALESCE(o.revenue_sum, 0),
  last_order_at = o.last_order_date
FROM (
  SELECT 
    customer_id,
    COUNT(*) as order_count,
    SUM(total) as revenue_sum,
    MAX(created_at) as last_order_date
  FROM orders
  GROUP BY customer_id
) o
WHERE c.id = o.customer_id;

-- Mettre à jour last_payment_at à partir de l'historique des paiements
UPDATE customers c
SET last_payment_at = p.last_payment
FROM (
  SELECT 
    customer_id,
    MAX(collected_at) as last_payment
  FROM payment_history
  GROUP BY customer_id
) p
WHERE c.id = p.customer_id;

-- Vérification
SELECT 
  COUNT(*) as total_customers,
  COUNT(last_payment_at) as with_payment_date,
  COUNT(last_order_at) as with_order_date,
  SUM(total_orders) as total_orders_sum
FROM customers;
