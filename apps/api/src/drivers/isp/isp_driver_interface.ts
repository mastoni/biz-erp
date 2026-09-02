import { ProvisioningJobDto } from '../../dto/provisioning_dto'
import { IspGatewayDto, IspSubscriberDto } from '../../dto/isp_dto'

export interface IspNetworkProvisionResult {
  gateway_id: string
  gateway_type: string
  status: 'SUCCESS' | 'FAILED'
  profile?: string
  pppoe_username?: string
  allocated_ip?: string
  queue_rate_limit?: string
  error?: string
}

export interface IspAcsProvisionResult {
  gateway_id: string
  gateway_type: string
  status: 'SUCCESS' | 'FAILED'
  ont_serial_number?: string
  tr069_sync?: string
  error?: string
}

export interface IspDriverExecutionResult {
  success: boolean
  action: string
  network_provisioning?: IspNetworkProvisionResult
  acs_provisioning?: IspAcsProvisionResult
  error?: string
  timestamp: string
}

export interface IspTelemetryResult {
  success: boolean
  device_id?: string
  online: boolean
  optical_rx_dbm?: number
  optical_tx_dbm?: number
  temperature_celsius?: number
  uptime_seconds?: number
  last_inform_time?: string
  error?: string
}

export interface IspTroubleshootingResult {
  success: boolean
  pppoe_status: 'AUTHENTICATED' | 'AUTH_FAILED' | 'DISCONNECTED' | 'DISABLED'
  interface_status: 'UP' | 'DOWN' | 'DISABLED'
  rate_limit_applied?: string
  active_ip?: string
  recommendation: string
}

export interface IspDriver {
  executeProvisioning(
    job: ProvisioningJobDto,
    subscriber: IspSubscriberDto,
    networkGateway: IspGatewayDto,
    acsGateway?: IspGatewayDto | null
  ): Promise<IspDriverExecutionResult>

  getDeviceTelemetry(
    subscriber: IspSubscriberDto,
    acsGateway?: IspGatewayDto | null
  ): Promise<IspTelemetryResult>

  rebootDevice(
    subscriber: IspSubscriberDto,
    acsGateway?: IspGatewayDto | null
  ): Promise<{ success: boolean; message: string }>

  diagnoseTroubleshooting(
    subscriber: IspSubscriberDto,
    networkGateway: IspGatewayDto
  ): Promise<IspTroubleshootingResult>
}
