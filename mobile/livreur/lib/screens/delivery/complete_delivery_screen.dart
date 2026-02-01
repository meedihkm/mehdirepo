// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - ÉCRAN COMPLÉTION LIVRAISON
// Signature, encaissement, preuve photo
// ═══════════════════════════════════════════════════════════════════════════════

import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:signature/signature.dart';

import '../../models/delivery.dart';
import '../../providers/delivery_provider.dart';
import '../../providers/sync_provider.dart';
import '../../services/connectivity_manager.dart';
import '../../widgets/amount_input.dart';
import '../../widgets/loading_overlay.dart';

class CompleteDeliveryScreen extends ConsumerStatefulWidget {
  final Delivery delivery;

  const CompleteDeliveryScreen({
    super.key,
    required this.delivery,
  });

  @override
  ConsumerState<CompleteDeliveryScreen> createState() =>
      _CompleteDeliveryScreenState();
}

class _CompleteDeliveryScreenState extends ConsumerState<CompleteDeliveryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _signatureController = SignatureController(
    penStrokeWidth: 3,
    penColor: Colors.black,
    exportBackgroundColor: Colors.white,
  );
  final _amountController = TextEditingController();
  final _notesController = TextEditingController();
  final _signatureNameController = TextEditingController();

  PaymentMode _collectionMode = PaymentMode.cash;
  bool _printReceipt = true;
  bool _printDeliveryNote = false;
  bool _isLoading = false;
  List<File> _photos = [];

  @override
  void initState() {
    super.initState();
    _amountController.text = widget.delivery.totalToCollect.toStringAsFixed(0);
  }

  @override
  void dispose() {
    _signatureController.dispose();
    _amountController.dispose();
    _notesController.dispose();
    _signatureNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isOnlineAsync = ref.watch(isOnlineProvider);
    final isOnline = isOnlineAsync.value ?? false;

    return LoadingOverlay(
      isLoading: _isLoading,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Compléter la livraison'),
          actions: [
            if (!isOnline)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.orange,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.cloud_off, size: 16, color: Colors.white),
                    SizedBox(width: 4),
                    Text('Hors ligne', style: TextStyle(color: Colors.white, fontSize: 12)),
                  ],
                ),
              ),
          ],
        ),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Résumé commande
              _buildOrderSummary(),
              const SizedBox(height: 24),

              // Montant à encaisser
              _buildAmountSection(),
              const SizedBox(height: 24),

              // Mode de paiement
              _buildPaymentModeSection(),
              const SizedBox(height: 24),

              // Signature
              _buildSignatureSection(),
              const SizedBox(height: 24),

              // Photos de preuve
              _buildPhotosSection(),
              const SizedBox(height: 24),

              // Notes
              _buildNotesSection(),
              const SizedBox(height: 24),

              // Options d'impression
              _buildPrintOptions(),
              const SizedBox(height: 32),

              // Bouton de validation
              _buildSubmitButton(),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOrderSummary() {
    final order = widget.delivery.order;
    final customer = widget.delivery.customer;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.receipt_long, color: Colors.blue),
                const SizedBox(width: 8),
                Text(
                  'Commande #${order.orderNumber}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Text(
              customer.name,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 4),
            Text(
              customer.fullAddress,
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 16),
            ...order.items.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Text('${item.quantity}x'),
                      const SizedBox(width: 8),
                      Expanded(child: Text(item.productName)),
                      Text(
                        '${item.lineTotal.toStringAsFixed(0)} DA',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                )),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total commande'),
                Text(
                  '${order.totalAmount.toStringAsFixed(0)} DA',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue,
                  ),
                ),
              ],
            ),
            if (customer.currentDebt > 0) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Dette client',
                    style: TextStyle(color: Colors.red[700]),
                  ),
                  Text(
                    '${customer.currentDebt.toStringAsFixed(0)} DA',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.red[700],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAmountSection() {
    final maxAmount = widget.delivery.totalToCollect + (widget.delivery.customer?.currentDebt ?? 0);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Montant encaissé',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _amountController,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              decoration: InputDecoration(
                suffixText: 'DA',
                suffixStyle: const TextStyle(fontSize: 20),
                border: const OutlineInputBorder(),
                helperText: 'Max: ${maxAmount.toStringAsFixed(0)} DA',
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Veuillez entrer un montant';
                }
                final amount = double.tryParse(value);
                if (amount == null || amount < 0) {
                  return 'Montant invalide';
                }
                if (amount > maxAmount) {
                  return 'Le montant dépasse le total dû';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                _buildQuickAmountChip(widget.delivery.amountToCollect, 'Commande'),
                _buildQuickAmountChip(
                  widget.delivery.amountToCollect + widget.delivery.customer.currentDebt,
                  'Total dû',
                ),
                _buildQuickAmountChip(0, 'À crédit'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickAmountChip(double amount, String label) {
    return ActionChip(
      label: Text('${amount.toStringAsFixed(0)} DA'),
      avatar: Text(label.substring(0, 1), style: const TextStyle(fontSize: 10)),
      onPressed: () {
        _amountController.text = amount.toStringAsFixed(0);
      },
    );
  }

  Widget _buildPaymentModeSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Mode de paiement',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: PaymentMode.values.map((mode) {
                return ChoiceChip(
                  label: Text(_getModeLabel(mode)),
                  selected: _collectionMode == mode,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() => _collectionMode = mode);
                    }
                  },
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  String _getModeLabel(PaymentMode mode) {
    switch (mode) {
      case PaymentMode.cash:
        return 'Espèces';
      case PaymentMode.check:
        return 'Chèque';
      case PaymentMode.bankTransfer:
        return 'Virement';
      case PaymentMode.mobilePayment:
        return 'Mobile';
    }
  }

  Widget _buildSignatureSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Signature du client',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                TextButton.icon(
                  icon: const Icon(Icons.clear),
                  label: const Text('Effacer'),
                  onPressed: () => _signatureController.clear(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _signatureNameController,
              decoration: const InputDecoration(
                labelText: 'Nom du signataire',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.person),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              height: 150,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey[300]!),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Signature(
                  controller: _signatureController,
                  backgroundColor: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotosSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Photos de preuve',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                TextButton.icon(
                  icon: const Icon(Icons.camera_alt),
                  label: const Text('Ajouter'),
                  onPressed: _addPhoto,
                ),
              ],
            ),
            if (_photos.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                height: 100,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _photos.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(
                              _photos[index],
                              width: 100,
                              height: 100,
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: InkWell(
                              onTap: () {
                                setState(() {
                                  _photos.removeAt(index);
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.all(4),
                                decoration: const BoxDecoration(
                                  color: Colors.red,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.close,
                                  size: 16,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ] else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: Text(
                    'Aucune photo ajoutée',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotesSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Notes',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Notes optionnelles...',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPrintOptions() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Impression',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SwitchListTile(
              title: const Text('Imprimer le reçu'),
              value: _printReceipt,
              onChanged: (value) => setState(() => _printReceipt = value),
              contentPadding: EdgeInsets.zero,
            ),
            SwitchListTile(
              title: const Text('Imprimer le bon de livraison'),
              value: _printDeliveryNote,
              onChanged: (value) => setState(() => _printDeliveryNote = value),
              contentPadding: EdgeInsets.zero,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton.icon(
        icon: const Icon(Icons.check_circle),
        label: const Text(
          'CONFIRMER LA LIVRAISON',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.green,
          foregroundColor: Colors.white,
        ),
        onPressed: _submit,
      ),
    );
  }

  Future<void> _addPhoto() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 80,
    );

    if (image != null) {
      setState(() {
        _photos.add(File(image.path));
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    // Vérifier la signature
    if (_signatureController.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Veuillez obtenir la signature du client'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      // Exporter la signature en base64
      final signatureBytes = await _signatureController.toPngBytes();
      final signatureData = signatureBytes != null
          ? base64Encode(signatureBytes)
          : null;

      // Convertir les photos en base64 (ou uploader)
      final photoUrls = <String>[];
      for (final photo in _photos) {
        final bytes = await photo.readAsBytes();
        photoUrls.add('data:image/jpeg;base64,${base64Encode(bytes)}');
      }

      final amount = double.parse(_amountController.text);

      // Compléter la livraison
      final result = await ref.read(deliveryNotifierProvider.notifier).completeDelivery(
            widget.delivery.id,
            CompleteDeliveryRequest(
              amountCollected: amount,
              collectionMode: _collectionMode,
              notes: _notesController.text,
              signature: signatureData != null
                  ? SignatureInfo(data: signatureData, name: _signatureNameController.text)
                  : null,
              photos: photoUrls.isNotEmpty
                  ? photoUrls.map((url) => DeliveryPhoto(data: url, type: 'delivery')).toList()
                  : null,
            ),
          );

      if (mounted) {
        // Afficher le résultat
        _showSuccessDialog(result);
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
        setState(() => _isLoading = false);
      }
    }
  }

  void _showSuccessDialog(DeliveryCompletionResult result) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 32),
            const SizedBox(width: 12),
            const Text('Livraison complétée'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reçu: ${result.receiptNumber}'),
            const SizedBox(height: 8),
            if (result.breakdown.appliedToOrder > 0)
              Text('Appliqué à la commande: ${result.breakdown.appliedToOrder.toStringAsFixed(0)} DA'),
            if (result.breakdown.appliedToDebt > 0)
              Text('Appliqué à la dette: ${result.breakdown.appliedToDebt.toStringAsFixed(0)} DA'),
            if (result.breakdown.newDebtCreated > 0)
              Text(
                'Nouvelle dette: ${result.breakdown.newDebtCreated.toStringAsFixed(0)} DA',
                style: const TextStyle(color: Colors.orange),
              ),
            const SizedBox(height: 8),
            Text(
              'Solde client: ${result.customerDebtAfter.toStringAsFixed(0)} DA',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            if (result.isPending)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  '⚠️ Sera synchronisé dès que la connexion sera rétablie',
                  style: TextStyle(color: Colors.orange, fontSize: 12),
                ),
              ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // Fermer le dialog
              Navigator.of(context).pop(); // Retourner à la liste
            },
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}
