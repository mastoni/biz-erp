/**
 * POS post-sale device orchestration.
 *
 * This module is presentation / device-orchestration ONLY. It contains no
 * hardware drivers (no WebUSB, no WebSerial, no native printer/drawer driver).
 *
 * Critical guarantee: a failure in the printer or cash-drawer trigger MUST NOT
 * affect the already-committed sale. Each device is invoked inside its own
 * try/catch and the outcome (triggered / error) is reported separately so the
 * caller can surface a non-blocking notice without rolling back the transaction.
 */

import type { DrawerConfig, PrinterConfig } from '@/features/settings/types';

export interface PostSaleDeviceResult {
  drawerTriggered: boolean;
  drawerError: string | null;
  printTriggered: boolean;
  printError: string | null;
}

export interface OrchestrateDevicesParams {
  drawer: Pick<DrawerConfig, 'openOnPayment'>;
  printer: Pick<PrinterConfig, 'autoPrint'>;
  /** Injected trigger so this stays testable and driver-free. */
  triggerDrawer: () => void;
  /** Injected trigger (e.g. window.print) so this stays testable and driver-free. */
  triggerPrint: () => void;
}

/**
 * Orchestrates cash-drawer + printer behavior after a successful sale commit.
 *
 * Returns a structured result; never throws. Device failures are captured per
 * device so the committed sale remains authoritative.
 */
export function orchestratePostSaleDevices(
  params: OrchestrateDevicesParams
): PostSaleDeviceResult {
  const result: PostSaleDeviceResult = {
    drawerTriggered: false,
    drawerError: null,
    printTriggered: false,
    printError: null,
  };

  if (params.drawer.openOnPayment) {
    try {
      params.triggerDrawer();
      result.drawerTriggered = true;
    } catch (err) {
      result.drawerError =
        err instanceof Error ? err.message : 'Cash drawer orchestration failed';
    }
  }

  if (params.printer.autoPrint) {
    try {
      params.triggerPrint();
      result.printTriggered = true;
    } catch (err) {
      result.printError =
        err instanceof Error ? err.message : 'Printer orchestration failed';
    }
  }

  return result;
}
