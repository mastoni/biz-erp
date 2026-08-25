import 'package:flutter/material.dart';
import '../auth_state_notifier.dart';
import '../auth_api_client.dart';
import 'business_selection_screen.dart';

class LoginScreen extends StatefulWidget {
  final AuthStateNotifier authNotifier;

  const LoginScreen({super.key, required this.authNotifier});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;
  String? _errorMsg;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });

    try {
      await widget.authNotifier.login(email, password);
    } on AuthException catch (e) {
      if (e.code == 'BUSINESS_SELECTION_REQUIRED' && e.businesses != null && e.businesses!.isNotEmpty) {
        widget.authNotifier.setAvailableBusinesses(e.businesses!);
        if (!mounted) return;
        setState(() => _isLoading = false);
        final selectedId = await Navigator.of(context).push<String>(
          MaterialPageRoute(
            builder: (_) => BusinessSelectionScreen(businesses: e.businesses!),
          ),
        );
        if (selectedId != null) {
          setState(() {
            _isLoading = true;
            _errorMsg = null;
          });
          try {
            await widget.authNotifier.login(email, password, selectedId);
          } on AuthException catch (e2) {
            setState(() {
              _errorMsg = e2.message;
              _isLoading = false;
            });
          } catch (e2) {
            setState(() {
              _errorMsg = 'Server sedang tidak dapat dihubungi. Silakan periksa koneksi internet Anda.';
              _isLoading = false;
            });
          }
        }
      } else {
        setState(() {
          _errorMsg = e.message;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMsg = 'Server sedang tidak dapat dihubungi. Silakan periksa koneksi internet Anda.';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Selamat Datang di BizERP',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 32),
              if (_errorMsg != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  color: Colors.red.shade100,
                  child: Text(
                    _errorMsg!,
                    style: TextStyle(color: Colors.red.shade900),
                  ),
                ),
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
                enabled: !_isLoading,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                decoration: InputDecoration(
                  labelText: 'Kata Sandi',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
                obscureText: _obscurePassword,
                enabled: !_isLoading,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isLoading ? null : _login,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Masuk'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
