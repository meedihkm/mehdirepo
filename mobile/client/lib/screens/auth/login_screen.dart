// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - APP CLIENT - ÉCRAN LOGIN
// Authentification par OTP (numéro de téléphone)
// ═══════════════════════════════════════════════════════════════════════════════

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'dart:async';

import '../../providers/providers.dart';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

enum AuthStep { phone, otp }

final authStepProvider = StateProvider<AuthStep>((ref) => AuthStep.phone);
final phoneProvider = StateProvider<String>((ref) => '');
final otpLoadingProvider = StateProvider<bool>((ref) => false);

// ═══════════════════════════════════════════════════════════════════════════════
// ÉCRAN LOGIN
// ═══════════════════════════════════════════════════════════════════════════════

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController();
  final _otpControllers = List.generate(6, (_) => TextEditingController());
  final _otpFocusNodes = List.generate(6, (_) => FocusNode());

  Timer? _resendTimer;
  int _resendCountdown = 0;
  String? _errorMessage;

  @override
  void dispose() {
    _phoneController.dispose();
    for (var c in _otpControllers) { c.dispose(); }
    for (var f in _otpFocusNodes) { f.dispose(); }
    _resendTimer?.cancel();
    super.dispose();
  }

  void _startResendTimer() {
    _resendCountdown = 60;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _resendCountdown--;
        if (_resendCountdown <= 0) timer.cancel();
      });
    });
  }

  Future<void> _requestOtp() async {
    final phone = _phoneController.text.trim();

    if (phone.isEmpty || phone.length < 10) {
      setState(() => _errorMessage = 'Numéro de téléphone invalide');
      return;
    }

    setState(() => _errorMessage = null);
    ref.read(otpLoadingProvider.notifier).state = true;

    try {
      final api = ref.read(apiServiceProvider);
      final response = await api.requestOtp(phone);

      if (response.success) {
        ref.read(phoneProvider.notifier).state = phone;
        ref.read(authStepProvider.notifier).state = AuthStep.otp;
        _startResendTimer();
      } else {
        throw Exception(response.errorMessage ?? 'Erreur lors de l\'envoi du code');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Erreur lors de l\'envoi du code: $e');
    } finally {
      ref.read(otpLoadingProvider.notifier).state = false;
    }
  }

  Future<void> _verifyOtp() async {
    final code = _otpControllers.map((c) => c.text).join('');
    final phone = ref.read(phoneProvider);

    if (code.length != 6) {
      setState(() => _errorMessage = 'Veuillez saisir le code complet');
      return;
    }

    setState(() => _errorMessage = null);
    ref.read(otpLoadingProvider.notifier).state = true;

    try {
      final api = ref.read(apiServiceProvider);
      final authService = ref.read(authServiceProvider);
      
      final response = await api.verifyOtp(phone, code);

      if (response.success && response.data != null) {
        // Sauvegarder la session
        await authService.saveSession(response.data!);
        
        if (context.mounted) context.go('/');
      } else {
        throw Exception(response.errorMessage ?? 'Code invalide');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Code incorrect');
      // Effacer les champs
      for (var c in _otpControllers) { c.clear(); }
      _otpFocusNodes[0].requestFocus();
    } finally {
      ref.read(otpLoadingProvider.notifier).state = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = ref.watch(authStepProvider);
    final isLoading = ref.watch(otpLoadingProvider);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 60),

              // Logo
              Center(
                child: Container(
                  width: 100, height: 100,
                  decoration: BoxDecoration(
                    color: Theme.of(context).primaryColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Icon(
                    Icons.local_shipping_rounded,
                    size: 50,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'AWID Client',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                step == AuthStep.phone
                    ? 'Connectez-vous avec votre numéro'
                    : 'Saisissez le code reçu par SMS',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: Colors.grey[600]),
              ),
              const SizedBox(height: 48),

              // Erreur
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Étape 1: Téléphone
              if (step == AuthStep.phone) ...[
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Numéro de téléphone',
                    hintText: '0555 123 456',
                    prefixIcon: Icon(Icons.phone),
                    prefixText: '+213 ',
                  ),
                  onSubmitted: (_) => _requestOtp(),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: isLoading ? null : _requestOtp,
                    child: isLoading
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Recevoir le code', style: TextStyle(fontSize: 16)),
                  ),
                ),
              ],

              // Étape 2: OTP
              if (step == AuthStep.otp) ...[
                // Retour
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    icon: const Icon(Icons.arrow_back, size: 18),
                    label: const Text('Changer le numéro'),
                    onPressed: () {
                      ref.read(authStepProvider.notifier).state = AuthStep.phone;
                      for (var c in _otpControllers) { c.clear(); }
                      _resendTimer?.cancel();
                    },
                  ),
                ),
                const SizedBox(height: 16),

                // Champs OTP
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(6, (index) {
                    return SizedBox(
                      width: 48, height: 56,
                      child: TextField(
                        controller: _otpControllers[index],
                        focusNode: _otpFocusNodes[index],
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        maxLength: 1,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                        decoration: InputDecoration(
                          counterText: '',
                          contentPadding: EdgeInsets.zero,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        onChanged: (value) {
                          if (value.isNotEmpty && index < 5) {
                            _otpFocusNodes[index + 1].requestFocus();
                          }
                          if (value.isEmpty && index > 0) {
                            _otpFocusNodes[index - 1].requestFocus();
                          }
                          // Auto-submit si complet
                          final code = _otpControllers.map((c) => c.text).join('');
                          if (code.length == 6) _verifyOtp();
                        },
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 24),

                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: isLoading ? null : _verifyOtp,
                    child: isLoading
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Vérifier', style: TextStyle(fontSize: 16)),
                  ),
                ),
                const SizedBox(height: 16),

                // Renvoyer
                Center(
                  child: _resendCountdown > 0
                      ? Text('Renvoyer dans ${_resendCountdown}s', style: TextStyle(color: Colors.grey[500]))
                      : TextButton(
                          onPressed: _requestOtp,
                          child: const Text('Renvoyer le code'),
                        ),
                ),
              ],

              const SizedBox(height: 48),
              Text(
                'En vous connectant, vous acceptez nos conditions\nd\'utilisation et notre politique de confidentialité.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
