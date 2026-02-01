// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ÉCRAN DE LIVRAISON ET ENCAISSEMENT
// lib/screens/delivery/delivery_screen.dart
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';

import '../../models/delivery.dart';
import '../../providers/delivery_provider.dart';
import '../../widgets/amount_input.dart';
import '../../widgets/quick_amount_buttons.dart';
import '../../theme/app_colors.dart';

class DeliveryScreen extends ConsumerStatefulWidget {
  final String deliveryId;

  const DeliveryScreen({super.key, required this.deliveryId});

  @override
  ConsumerState<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends ConsumerState<DeliveryScreen> {
  final _amountController = TextEditingController();
  final _notesController = TextEditingController();
  double _amountCollected = 0;
  bool _printDeliveryNote = false;
  bool _printReceipt = true;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _amountController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final deliveryAsync = ref.watch(deliveryDetailProvider(widget.deliveryId));
    final formatter = NumberFormat('#,###', 'fr_FR');

    return deliveryAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, stack) => Scaffold(
        appBar: AppBar(title: const Text('Erreur')),
        body: Center(child: Text('Erreur: $error')),
      ),
      data: (delivery) => Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text('#${delivery.orderNumber}'),
          actions: [
            // Appeler le client
            IconButton(
              icon: const Icon(Icons.phone),
              onPressed: () => _callCustomer(delivery),
            ),
            // Naviguer vers le client
            IconButton(
              icon: const Icon(Icons.navigation),
              onPressed: () => _navigateTo(delivery),
            ),
          ],
        ),
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Infos client
              _buildClientInfo(delivery),

              // Détail commande
              _buildOrderDetails(delivery, formatter),

              // Section encaissement
              _buildPaymentSection(delivery, formatter),

              // Options d'impression
              _buildPrintOptions(),

              // Boutons d'action
              _buildActionButtons(delivery),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Infos client
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildClientInfo(Delivery delivery) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Nom client
          Row(
            children: [
              CircleAvatar(
                backgroundColor: AppColors.primary.withOpacity(0.1),
                child: Text(
                  delivery.customerName[0].toUpperCase(),
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      delivery.customerName,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (delivery.customerZone != null)
                      Text(
                        delivery.customerZone!,
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 13,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),

          const Divider(height: 24),

          // Adresse
          InkWell(
            onTap: () => _navigateTo(delivery),
            child: Row(
              children: [
                Icon(Icons.location_on, color: Colors.grey[600], size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    delivery.customerAddress,
                    style: TextStyle(color: Colors.grey[700]),
                  ),
                ),
                Icon(Icons.navigation, color: AppColors.primary, size: 20),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Téléphone
          InkWell(
            onTap: () => _callCustomer(delivery),
            child: Row(
              children: [
                Icon(Icons.phone, color: Colors.grey[600], size: 20),
                const SizedBox(width: 8),
                Text(
                  delivery.customerPhone,
                  style: TextStyle(color: Colors.grey[700]),
                ),
                const Spacer(),
                Icon(Icons.call, color: AppColors.primary, size: 20),
              ],
            ),
          ),

          // Notes de livraison
          if (delivery.customerDeliveryNotes != null &&
              delivery.customerDeliveryNotes!.isNotEmpty) ...[
            const Divider(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, color: Colors.orange[700], size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    delivery.customerDeliveryNotes!,
                    style: TextStyle(
                      color: Colors.orange[700],
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Détail commande
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildOrderDetails(Delivery delivery, NumberFormat formatter) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // En-tête
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.receipt_long, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Détail commande',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Text(
                  '${delivery.items.length} articles',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),

          const Divider(height: 1),

          // Liste des articles
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: delivery.items.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 16, endIndent: 16),
            itemBuilder: (context, index) {
              final item = delivery.items[index];
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    // Quantité
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(
                        child: Text(
                          '×${item.quantity.toStringAsFixed(item.quantity.truncateToDouble() == item.quantity ? 0 : 1)}',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Nom produit
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.productName,
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                          Text(
                            '${formatter.format(item.unitPrice)} DZD/${item.unit}',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Prix total
                    Text(
                      '${formatter.format(item.totalPrice)} DZD',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              );
            },
          ),

          const Divider(height: 1),

          // Totaux
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Sous-total commande
                _buildTotalRow(
                  'Commande',
                  '${formatter.format(delivery.orderAmount)} DZD',
                ),

                // Dette existante
                if (delivery.existingDebt > 0) ...[
                  const SizedBox(height: 8),
                  _buildTotalRow(
                    'Dette existante',
                    '${formatter.format(delivery.existingDebt)} DZD',
                    isDebt: true,
                  ),
                ],

                const Divider(height: 16),

                // Total à collecter
                _buildTotalRow(
                  'TOTAL À COLLECTER',
                  '${formatter.format(delivery.totalToCollect)} DZD',
                  isTotal: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalRow(String label, String value, {bool isDebt = false, bool isTotal = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: isTotal ? 16 : 14,
                fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
                color: isDebt ? Colors.orange[700] : null,
              ),
            ),
            if (isDebt) ...[
              const SizedBox(width: 4),
              Icon(Icons.warning_amber, size: 16, color: Colors.orange[700]),
            ],
          ],
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isTotal ? 18 : 14,
            fontWeight: isTotal ? FontWeight.bold : FontWeight.w500,
            color: isTotal ? AppColors.primary : (isDebt ? Colors.orange[700] : null),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Encaissement
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildPaymentSection(Delivery delivery, NumberFormat formatter) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Titre
          Row(
            children: [
              const Icon(Icons.payments, color: Colors.green),
              const SizedBox(width: 8),
              const Text(
                'Encaissement',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Input montant
          AmountInput(
            controller: _amountController,
            label: 'Montant reçu',
            onChanged: (value) {
              setState(() {
                _amountCollected = double.tryParse(value) ?? 0;
              });
            },
          ),

          const SizedBox(height: 12),

          // Boutons montants rapides
          QuickAmountButtons(
            amounts: [500, 1000, 2000, 5000],
            totalAmount: delivery.totalToCollect,
            onAmountSelected: (amount) {
              setState(() {
                _amountCollected = amount;
                _amountController.text = amount.toStringAsFixed(0);
              });
            },
          ),

          const SizedBox(height: 16),

          // Résumé du paiement
          _buildPaymentSummary(delivery, formatter),

          const SizedBox(height: 16),

          // Notes
          TextField(
            controller: _notesController,
            decoration: InputDecoration(
              labelText: 'Notes (optionnel)',
              hintText: 'Ex: Client absent, laissé chez le voisin',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
            maxLines: 2,
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentSummary(Delivery delivery, NumberFormat formatter) {
    // Calcul de la répartition
    final orderAmount = delivery.orderAmount;
    final existingDebt = delivery.existingDebt;
    final amountPaid = _amountCollected;

    double appliedToOrder = 0;
    double appliedToDebt = 0;
    double newDebt = 0;

    if (amountPaid >= orderAmount) {
      appliedToOrder = orderAmount;
      appliedToDebt = (amountPaid - orderAmount).clamp(0, existingDebt);
    } else {
      appliedToOrder = amountPaid;
      newDebt = orderAmount - amountPaid;
    }

    final remainingDebt = existingDebt - appliedToDebt + newDebt;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        children: [
          _buildSummaryRow(
            'Appliqué à la commande',
            '${formatter.format(appliedToOrder)} DZD',
            appliedToOrder >= orderAmount ? Colors.green : Colors.orange,
          ),
          const SizedBox(height: 8),
          if (existingDebt > 0)
            _buildSummaryRow(
              'Appliqué à la dette',
              '${formatter.format(appliedToDebt)} DZD',
              appliedToDebt > 0 ? Colors.green : Colors.grey,
            ),
          if (newDebt > 0) ...[
            const SizedBox(height: 8),
            _buildSummaryRow(
              'Nouvelle dette',
              '+${formatter.format(newDebt)} DZD',
              Colors.orange,
            ),
          ],
          const Divider(height: 16),
          _buildSummaryRow(
            'Dette après livraison',
            '${formatter.format(remainingDebt)} DZD',
            remainingDebt > 0 ? Colors.red : Colors.green,
            isBold: true,
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, Color color, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Options d'impression
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildPrintOptions() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          // Bon de livraison
          SwitchListTile(
            value: _printDeliveryNote,
            onChanged: (value) => setState(() => _printDeliveryNote = value),
            title: const Text('Imprimer bon de livraison'),
            secondary: const Icon(Icons.description_outlined),
            contentPadding: EdgeInsets.zero,
          ),
          // Reçu de paiement
          SwitchListTile(
            value: _printReceipt,
            onChanged: (value) => setState(() => _printReceipt = value),
            title: const Text('Imprimer reçu de paiement'),
            secondary: const Icon(Icons.receipt_outlined),
            contentPadding: EdgeInsets.zero,
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Boutons d'action
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildActionButtons(Delivery delivery) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Confirmer livraison
          ElevatedButton.icon(
            onPressed: _isSubmitting ? null : () => _completeDelivery(delivery),
            icon: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check_circle),
            label: Text(_isSubmitting ? 'Enregistrement...' : 'Confirmer livraison'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),

          const SizedBox(height: 12),

          // Échec de livraison
          OutlinedButton.icon(
            onPressed: _isSubmitting ? null : () => _failDelivery(delivery),
            icon: const Icon(Icons.cancel_outlined),
            label: const Text('Livraison impossible'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.red,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<void> _navigateTo(Delivery delivery) async {
    if (delivery.customerCoordinates != null) {
      final lat = delivery.customerCoordinates!.lat;
      final lng = delivery.customerCoordinates!.lng;
      final url = 'google.navigation:q=$lat,$lng&mode=d';
      if (await canLaunchUrl(Uri.parse(url))) {
        await launchUrl(Uri.parse(url));
      } else {
        final webUrl = 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng';
        await launchUrl(Uri.parse(webUrl), mode: LaunchMode.externalApplication);
      }
    }
  }

  Future<void> _callCustomer(Delivery delivery) async {
    await launchUrl(Uri.parse('tel:${delivery.customerPhone}'));
  }

  Future<void> _completeDelivery(Delivery delivery) async {
    setState(() => _isSubmitting = true);

    try {
      final request = CompleteDeliveryRequest(
        amountCollected: _amountCollected,
        collectionMode: 'cash',
        notes: _notesController.text.isEmpty ? null : _notesController.text,
      );

      final result = await ref
          .read(deliveryProvider.notifier)
          .completeDelivery(delivery.id, request);

      if (mounted) {
        // Afficher le résultat
        await _showCompletionResult(result);

        // Imprimer si demandé
        if (_printReceipt && result.printUrls?.receiptUrl != null) {
          // Lancer l'impression Bluetooth ou afficher le PDF
        }

        // Retourner à la liste
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _failDelivery(Delivery delivery) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => _FailReasonDialog(),
    );

    if (reason == null || reason.isEmpty) return;

    setState(() => _isSubmitting = true);

    try {
      await ref.read(deliveryProvider.notifier).failDelivery(delivery.id, reason);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Livraison marquée comme échouée'),
            backgroundColor: Colors.orange,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _showCompletionResult(DeliveryCompletionResult result) async {
    final formatter = NumberFormat('#,###', 'fr_FR');
    final tx = result.transaction;

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 28),
            const SizedBox(width: 8),
            const Text('Livraison réussie!'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _resultRow('Collecté', '${formatter.format(tx.amountPaid)} DZD'),
            _resultRow('→ Sur commande', '${formatter.format(tx.appliedToOrder)} DZD'),
            if (tx.appliedToDebt > 0)
              _resultRow('→ Sur dette', '${formatter.format(tx.appliedToDebt)} DZD'),
            if (tx.newDebtCreated > 0)
              _resultRow('Nouvelle dette', '+${formatter.format(tx.newDebtCreated)} DZD',
                  isWarning: true),
            const Divider(),
            _resultRow('Dette client', '${formatter.format(tx.debtAfter)} DZD',
                isBold: true, color: tx.debtAfter > 0 ? Colors.orange : Colors.green),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  Widget _resultRow(String label, String value,
      {bool isBold = false, bool isWarning = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(
            value,
            style: TextStyle(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: color ?? (isWarning ? Colors.orange : null),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIALOG: Raison d'échec
// ═══════════════════════════════════════════════════════════════════════════════

class _FailReasonDialog extends StatefulWidget {
  @override
  State<_FailReasonDialog> createState() => _FailReasonDialogState();
}

class _FailReasonDialogState extends State<_FailReasonDialog> {
  String? _selectedReason;
  final _customController = TextEditingController();

  final _reasons = [
    'Client absent',
    'Adresse introuvable',
    'Client refuse la livraison',
    'Produit endommagé',
    'Erreur de commande',
    'Autre (préciser)',
  ];

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Raison de l\'échec'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ..._reasons.map((reason) => RadioListTile<String>(
                  value: reason,
                  groupValue: _selectedReason,
                  title: Text(reason),
                  onChanged: (value) => setState(() => _selectedReason = value),
                  contentPadding: EdgeInsets.zero,
                )),
            if (_selectedReason == 'Autre (préciser)') ...[
              const SizedBox(height: 8),
              TextField(
                controller: _customController,
                decoration: const InputDecoration(
                  labelText: 'Précisez',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Annuler'),
        ),
        ElevatedButton(
          onPressed: _selectedReason != null
              ? () {
                  final reason = _selectedReason == 'Autre (préciser)'
                      ? _customController.text
                      : _selectedReason;
                  Navigator.pop(context, reason);
                }
              : null,
          child: const Text('Confirmer'),
        ),
      ],
    );
  }
}
