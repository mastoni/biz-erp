import { ProvisioningJobDto } from '../../dto/provisioning_dto'
import { IspGatewayDto, IspSubscriberDto } from '../../dto/isp_dto'
import {
  IspDriver,
  IspDriverExecutionResult,
  IspTelemetryResult,
  IspTroubleshootingResult,
} from './isp_driver_interface'

export class MockIspDriver implements IspDriver {
  private rebootCount = 0
  private failNextProvisioning = false

  public setFailNextProvisioning(fail: boolean): void {
    this.failNextProvisioning = fail
  }

  public getRebootCount(): number {
    return this.rebootCount
  }

  async executeProvisioning(
    job: ProvisioningJobDto,
    subscriber: IspSubscriberDto,
    networkGateway: IspGatewayDto,
    acsGateway?: IspGatewayDto | null
  ): Promise<IspDriverExecutionResult> {
    if (this.failNextProvisioning) {
      this.failNextProvisioning = false
      return {
        success: false,
        action: job.action,
        error: 'Simulated network gateway driver connection timeout',
        timestamp: new Date().toISOString(),
      }
    }

    const networkResult = {
      gateway_id: networkGateway.id,
      gateway_type: networkGateway.gateway_type,
      status: 'SUCCESS' as const,
      pppoe_username: subscriber.pppoe_username,
      allocated_ip: subscriber.ip_address || '10.100.1.50',
      queue_rate_limit: job.action === 'SUSPEND' ? '256k/256k' : '50M/20M',
      profile: job.action === 'SUSPEND' ? 'ISOLATED_SUSPENDED' : 'STANDARD_ACTIVE',
    }

    let acsResult = undefined
    if (acsGateway) {
      acsResult = {
        gateway_id: acsGateway.id,
        gateway_type: acsGateway.gateway_type,
        status: 'SUCCESS' as const,
        ont_serial_number: subscriber.ont_serial_number || 'MOCK_ONT_001',
        tr069_sync: job.action === 'SUSPEND' ? 'SUSPENDED_TAGGED' : 'SYNCHRONIZED',
      }
    }

    return {
      success: true,
      action: job.action,
      network_provisioning: networkResult,
      acs_provisioning: acsResult,
      timestamp: new Date().toISOString(),
    }
  }

  async getDeviceTelemetry(
    subscriber: IspSubscriberDto,
    acsGateway?: IspGatewayDto | null
  ): Promise<IspTelemetryResult> {
    if (!acsGateway && !subscriber.ont_serial_number) {
      return {
        success: false,
        online: false,
        error: 'No ACS Gateway or ONT Serial Number configured for this subscriber',
      }
    }

    return {
      success: true,
      device_id: subscriber.ont_serial_number || 'MOCK_ONT_DEFAULT',
      online: true,
      optical_rx_dbm: -19.45,
      optical_tx_dbm: 2.15,
      temperature_celsius: 42.5,
      uptime_seconds: 345600,
      last_inform_time: new Date().toISOString(),
    }
  }

  async rebootDevice(
    subscriber: IspSubscriberDto,
    _acsGateway?: IspGatewayDto | null
  ): Promise<{ success: boolean; message: string }> {
    this.rebootCount++
    return {
      success: true,
      message: `Perintah reboot berhasil dikirimkan ke perangkat ONT ${subscriber.ont_serial_number || subscriber.pppoe_username}`,
    }
  }

  async diagnoseTroubleshooting(
    subscriber: IspSubscriberDto,
    _networkGateway: IspGatewayDto
  ): Promise<IspTroubleshootingResult> {
    if (subscriber.status === 'SUSPENDED') {
      return {
        success: true,
        pppoe_status: 'DISABLED',
        interface_status: 'DISABLED',
        rate_limit_applied: '256k/256k',
        recommendation: 'Layanan internet dalam status SUSPEND. Mohon selesaikan tagihan pembayaran untuk mengaktifkan kembali.',
      }
    }

    return {
      success: true,
      pppoe_status: 'AUTHENTICATED',
      interface_status: 'UP',
      rate_limit_applied: '50M/20M',
      active_ip: subscriber.ip_address || '10.100.1.50',
      recommendation: 'Koneksi PPPoE dan status interface router normal.',
    }
  }
}
